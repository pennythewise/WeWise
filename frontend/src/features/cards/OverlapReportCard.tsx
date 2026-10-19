import { useState } from 'react';
import { L, type L as LT } from '@/engine/l';
import { Badge, CardShell, Notice } from '@/components/ui';
import { AppIcon } from '@/components/AppIcon';
import { InsurerMark } from '@/components/InsurerMark';
import { RichText } from '../chat/CitationChip';
import { policyById } from '@/mock/policies';
import { useTx } from '@/i18n/useTx';

type Kind = 'overlap' | 'gap' | 'single' | 'risk';
interface Source { policyId: string | 'platform'; ok: boolean; cite?: string }
interface Row { area: LT; kind: Kind; sources: Source[]; why: LT; gig?: boolean }

/** Cross-insurer overlap and gap matrix (PRD D2). Gig rows appear when the user says they do platform work. */
const ROWS: Row[] = [
  { area: L('Hospital bills after an accident', '意外导致的住院费用'), kind: 'overlap', sources: [{ policyId: 'pol_mei_health_01', ok: true, cite: 'HS-3.1' }, { policyId: 'pol_mei_pa_01', ok: true, cite: 'PA-2.4' }],
    why: L('Both can pay. You are never paid more than the bill, but the accident plan\'s ¥10,000 can cover your hospital deductible [[HS-5.4]].', '两份都可赔付。赔付总额不会超过账单金额，但意外险的 ¥10,000 可以用来支付住院自付额 [[HS-5.4]]。') },
  { area: L('Accident treatment during your trip', '旅行期间的意外治疗'), kind: 'overlap', sources: [{ policyId: 'pol_mei_travel_01', ok: true, cite: 'TR-3.1' }, { policyId: 'pol_mei_pa_01', ok: true, cite: 'PA-2.4' }],
    why: L('Travel cover pays overseas bills first; the accident plan can top up. Tell each insurer about the other policy when you claim.', '旅行险优先赔付海外费用，意外险可补充。理赔时请向双方说明另一份保单。') },
  { area: L('Accidental death or disability', '意外身故或伤残'), kind: 'single', sources: [{ policyId: 'pol_mei_pa_01', ok: true, cite: 'PA-2.1' }], why: L('Covered once, ¥300,000.', '由一份保单保障，¥300,000。') },
  { area: L('Injury to others', '对他人造成的伤害'), kind: 'single', sources: [{ policyId: 'pol_mei_motor_01', ok: true, cite: 'MO-4.2' }, { policyId: 'pol_mei_home_01', ok: true }],
    why: L('Different situations (on the road vs at home), so no double payment.', '分别对应道路和家中两种情形，不存在重复。') },
  { area: L('Outpatient visits', '门诊'), kind: 'gap', sources: [{ policyId: 'pol_mei_health_01', ok: false, cite: 'HS-9.1' }], why: L('Not covered unless linked to a hospital stay [[HS-9.1]].', '与住院无关的门诊不赔 [[HS-9.1]]。') },
  { area: L('Critical illness lump sum', '重疾一次性赔付'), kind: 'gap', sources: [], why: L('No policy pays a lump sum on diagnosis.', '没有任何保单在确诊时一次性赔付。') },
  { area: L('Income if you can\'t work', '无法工作时的收入'), kind: 'gap', sources: [], why: L('Nothing replaces your income during a long illness.', '长期患病期间没有保障可以替代收入。') },
  { area: L('Injury while delivering', '配送期间受伤'), kind: 'risk', gig: true, sources: [{ policyId: 'pol_mei_pa_01', ok: false, cite: 'PA-5.4' }, { policyId: 'platform', ok: true }],
    why: L('Your accident plan excludes paid delivery work [[PA-5.4]]. Only the platform\'s cover applies, and usually only while you are logged in on an order. Declaring the job to your insurer can fix this.', '您的意外险不保有偿配送工作 [[PA-5.4]]，只有平台保障适用，且通常仅限接单在线期间。向保险公司申报职业可以解决。') },
  { area: L('Car accident while delivering', '配送时发生车祸'), kind: 'gap', gig: true, sources: [{ policyId: 'pol_mei_motor_01', ok: false, cite: 'MO-6.3' }],
    why: L('Your motor plan is for private use only [[MO-6.3]]. Damage to your car and injury to others during a delivery may not be covered at all. A commercial-use endorsement closes this gap.', '您的车险仅限私人用途 [[MO-6.3]]，配送期间的车损和第三者伤害可能完全不赔。加批商业用途条款可以补上这个缺口。') },
];

const KIND = {
  overlap: { tone: 'info', label: L('Overlap', '重叠') },
  single: { tone: 'ok', label: L('Covered', '已保障') },
  gap: { tone: 'danger', label: L('Gap', '缺口') },
  risk: { tone: 'warn', label: L('Partly covered', '部分保障') },
} as const;

function SourceChip({ s }: { s: Source }) {
  const { tx } = useTx();
  const p = s.policyId === 'platform' ? null : policyById(s.policyId);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2 text-xs ${s.ok ? 'border-cardline bg-white text-ink' : 'border-[#F6CBC6] bg-[var(--wb-danger-bg)] text-danger line-through decoration-1'}`}>
      {p ? <InsurerMark id={p.insurerId} size={18} /> : <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-ink text-[10px] font-semibold text-white">P</span>}
      {p ? tx(p.product) : tx(L('Platform cover', '平台保障'))}
    </span>
  );
}

export function OverlapReportCard({ gig: initialGig = false, messageId }: { gig?: boolean; messageId?: string }) {
  const { tx } = useTx();
  const [gig, setGig] = useState(initialGig);
  const rows = ROWS.filter((r) => gig || !r.gig);
  const count = (k: Kind) => rows.filter((r) => r.kind === k).length;

  return (
    <CardShell title={tx(L('Overlaps and gaps across your insurers', '跨保险公司的重叠与缺口'))} icon="search">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-input bg-bluewash p-2"><p className="text-[20px] font-semibold text-brand">{count('overlap')}</p><p className="text-xs text-muted">{tx(L('overlaps', '重叠'))}</p></div>
        <div className="rounded-input bg-[var(--wb-danger-bg)] p-2"><p className="text-[20px] font-semibold text-danger">{count('gap')}</p><p className="text-xs text-muted">{tx(L('gaps', '缺口'))}</p></div>
        <div className="rounded-input bg-[#FFF6E5] p-2"><p className="text-[20px] font-semibold text-warn">{count('risk')}</p><p className="text-xs text-muted">{tx(L('partly covered', '部分保障'))}</p></div>
      </div>
      <label className="mt-3 flex min-h-touch items-center justify-between gap-3 rounded-input border border-cardline px-3 text-[13px] font-medium text-ink">
        <span className="flex items-center gap-2"><AppIcon name="briefcase" size={18} className="text-brand" />{tx(L('I also do delivery or ride-hailing work', '我也做外卖配送或网约车'))}</span>
        <input type="checkbox" role="switch" checked={gig} onChange={(e) => setGig(e.target.checked)} data-testid="gig-toggle" className="h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-[#C9D3EC] transition-colors checked:bg-primary [&::before]:m-0.5 [&::before]:block [&::before]:h-5 [&::before]:w-5 [&::before]:rounded-full [&::before]:bg-white [&::before]:transition-transform [&::before]:content-[''] checked:[&::before]:translate-x-5" />
      </label>
      <ul className="mt-3 space-y-2">
        {rows.map((r) => (
          <li key={r.area.en} className={`rounded-input border p-3 ${r.gig ? 'border-[#F2D3A4] bg-[#FFFBF3]' : 'border-cardline'}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-[14px] font-semibold text-ink">{tx(r.area)}</p>
              <Badge tone={KIND[r.kind].tone} icon={r.kind === 'single' ? 'check' : 'info'}>{tx(KIND[r.kind].label)}</Badge>
            </div>
            {r.sources.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1.5">{r.sources.map((s, i) => <SourceChip key={i} s={s} />)}</div>}
            <p className="mt-1.5 text-[13px] leading-relaxed text-body"><RichText text={tx(r.why)} messageId={messageId} /></p>
          </li>
        ))}
      </ul>
      {gig && <div className="mt-3"><Notice tone="warn">{tx(L('Platform cover terms vary and are illustrative here. Check your platform\'s terms for when you are covered (logged in, on an order, commuting).', '各平台保障条款不同，此处仅作示意。请查看平台条款，确认何时受保障（在线、接单中、通勤途中）。'))}</Notice></div>}
      <p className="mt-3 text-xs text-muted">{tx(L('Decision support only. Overlapping cover never pays more than your actual loss.', '仅供决策参考。重叠保障的赔付总额不会超过实际损失。'))}</p>
    </CardShell>
  );
}
