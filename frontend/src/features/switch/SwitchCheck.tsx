import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { L, addDays, daysBetween, DEMO_TODAY } from '@/engine/l';
import { Badge, CardShell, Notice } from '@/components/ui';
import { AppIcon } from '@/components/AppIcon';
import { useTx } from '@/i18n/useTx';
import { useAgentStore } from '@/agentStore';

/** Inputs for the surrender-and-rebuy check. Defaults are a synthetic example: a 67-year-old parent with an 8-year-old endowment. */
export interface SwitchInputs {
  age: number;
  oldName: string; oldPremium: number; yearsPaid: number; termYears: number; surrenderValue: number; maturityValue: number;
  newName: string; newPremium: number; guaranteedPct: number; illustratedPct: number;
  signedOn: string; coolingDays: number;
}
export const DEFAULT_SWITCH: SwitchInputs = {
  age: 67,
  oldName: 'Endowment policy (bought 2018)', oldPremium: 12000, yearsPaid: 8, termYears: 15, surrenderValue: 61500, maturityValue: 210000,
  newName: 'New "wealth" savings plan', newPremium: 15000, guaranteedPct: 1.5, illustratedPct: 4.5,
  signedOn: addDays(DEMO_TODAY, -4), coolingDays: 15,
};

/** Future value of yearly premiums paid at the start of each year. */
const fv = (p: number, r: number, n: number) => (r === 0 ? p * n : p * ((Math.pow(1 + r, n) - 1) / r) * (1 + r));

export function computeSwitch(i: SwitchInputs) {
  const paid = i.oldPremium * i.yearsPaid;
  const loss = Math.max(0, paid - i.surrenderValue);
  const lossPct = paid ? Math.round((loss / paid) * 100) : 0;
  const yearsLeft = Math.max(0, i.termYears - i.yearsPaid);
  // Compare both paths over the same horizon (until the old policy would have matured), guaranteed values only.
  const keepOut = i.oldPremium * yearsLeft, keepBack = i.maturityValue;
  const switchOut = i.newPremium * yearsLeft;
  const switchBack = i.surrenderValue * Math.pow(1 + i.guaranteedPct / 100, yearsLeft) + fv(i.newPremium, i.guaranteedPct / 100, yearsLeft);
  const keepNet = keepBack - keepOut, switchNet = switchBack - switchOut;
  const coolingLeft = i.coolingDays - daysBetween(i.signedOn, DEMO_TODAY);
  return { paid, loss, lossPct, yearsLeft, keepNet, switchNet, diff: keepNet - switchNet, coolingLeft };
}

const FLAGS = [
  { id: 'cancel', w: 3, text: L('Told to cancel or surrender the old policy first', '被要求先退掉旧保单') },
  { id: 'guarantee', w: 3, text: L('Promised high "guaranteed" returns', '被承诺高额“保证”收益') },
  { id: 'refund', w: 3, text: L('Offered a "full refund" of premiums for a fee', '有人收费帮忙“全额退保”') },
  { id: 'rush', w: 2, text: L('Pressured to sign today or the offer ends', '被催促今天就签，否则优惠结束') },
  { id: 'loan', w: 2, text: L('Advised to borrow or use savings or pension to pay', '被建议借钱或动用储蓄 / 养老金缴费') },
  { id: 'blank', w: 2, text: L('Asked to sign a blank or unread form', '被要求签署空白或未读过的文件') },
  { id: 'nocool', w: 1, text: L('Nobody mentioned the cooling-off period', '没有人提到犹豫期') },
  { id: 'cold', w: 1, text: L('Contacted out of the blue by a "policy upgrade" service', '突然有“保单升级”服务主动联系') },
] as const;

function Money({ n, tone }: { n: number; tone?: 'ok' | 'danger' }) {
  const { money } = useTx();
  return <span className={`font-semibold tabular-nums ${tone === 'ok' ? 'text-ok' : tone === 'danger' ? 'text-danger' : 'text-ink'}`}>{n < 0 ? '−' : ''}{money(Math.abs(n))}</span>;
}

function NumField({ label, value, onChange, step = 1, suffix }: { label: string; value: number; onChange: (n: number) => void; step?: number; suffix?: string }) {
  return (
    <label className="block text-xs text-muted">{label}
      <span className="mt-0.5 flex items-center gap-1.5">
        <input type="number" inputMode="decimal" step={step} value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} className="min-h-[44px] w-full min-w-0 rounded-input border border-line bg-white px-3 text-[15px] tabular-nums text-ink" />
        {suffix && <span className="shrink-0 text-[13px] text-muted">{suffix}</span>}
      </span>
    </label>
  );
}

/** Full switching / surrender-and-rebuy check (PRD B5). Plain words, large numbers, and a share-with-family summary for older adults. */
export function SwitchCheck() {
  const { tx, money, date } = useTx();
  const navigate = useNavigate();
  const [v, setV] = useState<SwitchInputs>(DEFAULT_SWITCH);
  const [flags, setFlags] = useState<Record<string, boolean>>({ cancel: true, rush: true });
  const [share, setShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const r = useMemo(() => computeSwitch(v), [v]);
  const set = <K extends keyof SwitchInputs>(k: K) => (x: SwitchInputs[K]) => setV({ ...v, [k]: x });
  const score = FLAGS.reduce((s, f) => s + (flags[f.id] ? f.w : 0), 0) + (r.diff > 0 ? 2 : 0) + (v.age >= 60 ? 1 : 0);
  const risk = score >= 6 ? 'high' : score >= 3 ? 'medium' : 'low';
  const riskTone = risk === 'high' ? 'danger' : risk === 'medium' ? 'warn' : 'ok';

  const summary = tx(L(
    `WeWise switching check: surrendering "${v.oldName}" now returns ${money(v.surrenderValue)} of ${money(r.paid)} paid (loss ${money(r.loss)}). Over the next ${r.yearsLeft} years, keeping it is about ${money(r.diff)} better on guaranteed values. Red flags: ${FLAGS.filter((f) => flags[f.id]).length}. Please talk before signing anything. Cooling-off ends ${date(addDays(v.signedOn, v.coolingDays))}.`,
    `微晓换保检查：现在退掉“${v.oldName}”只能拿回 ${money(v.surrenderValue)}，已交 ${money(r.paid)}（损失 ${money(r.loss)}）。未来 ${r.yearsLeft} 年按保证收益计，继续持有约好 ${money(r.diff)}。风险信号：${FLAGS.filter((f) => flags[f.id]).length} 项。签字前请先商量。犹豫期截至 ${date(addDays(v.signedOn, v.coolingDays))}。`,
  ));
  const copy = async () => { try { await navigator.clipboard.writeText(summary); } catch { /* ignore */ } setCopied(true); setTimeout(() => setCopied(false), 1500); };

  return (
    <div className="space-y-4" data-screen="switchCheck">
      <section className={`rounded-card border p-4 ${risk === 'high' ? 'border-[#F6CBC6] bg-[var(--wb-danger-bg)]' : risk === 'medium' ? 'border-[#F2D3A4] bg-[#FFF6E5]' : 'border-cardline bg-white'}`} aria-live="polite">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[17px] font-semibold text-ink">{tx(L('Switching risk', '换保风险'))}</h2>
          <Badge tone={riskTone} icon="info">{tx(risk === 'high' ? L('High: pause before signing', '高：签字前请暂停') : risk === 'medium' ? L('Medium: check carefully', '中：请仔细核对') : L('Low', '低'))}</Badge>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-[13px]">
          <div><dt className="text-xs text-muted">{tx(L('Lost if surrendered now', '现在退保损失'))}</dt><dd className="text-[22px]"><Money n={-r.loss} tone="danger" /></dd><dd className="text-xs text-muted">{tx(L(`${r.lossPct}% of the ${money(r.paid)} paid`, `占已交 ${money(r.paid)} 的 ${r.lossPct}%`))}</dd></div>
          <div><dt className="text-xs text-muted">{tx(L(`Keeping is better by (over ${r.yearsLeft} yrs)`, `继续持有更好（${r.yearsLeft} 年内）`))}</dt><dd className="text-[22px]"><Money n={r.diff} tone={r.diff > 0 ? 'ok' : 'danger'} /></dd><dd className="text-xs text-muted">{tx(L('guaranteed values only', '仅按保证收益计'))}</dd></div>
        </dl>
      </section>

      <CardShell title={tx(L('The two policies', '两份保单'))} icon="file">
        <div className="space-y-3">
          <NumField label={tx(L('Policyholder age', '投保人年龄'))} value={v.age} onChange={set('age')} />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{tx(L('Current policy', '现有保单'))}</p>
          <input aria-label={tx(L('Current policy name', '现有保单名称'))} value={v.oldName} onChange={(e) => set('oldName')(e.target.value)} className="min-h-[44px] w-full rounded-input border border-line px-3 text-[14px] text-ink" />
          <div className="grid grid-cols-2 gap-2">
            <NumField label={tx(L('Yearly premium', '年缴保费'))} value={v.oldPremium} onChange={set('oldPremium')} step={500} suffix="¥" />
            <NumField label={tx(L('Years paid', '已缴年数'))} value={v.yearsPaid} onChange={set('yearsPaid')} />
            <NumField label={tx(L('Surrender value now', '现金价值'))} value={v.surrenderValue} onChange={set('surrenderValue')} step={500} suffix="¥" />
            <NumField label={tx(L('Guaranteed at maturity', '满期保证金额'))} value={v.maturityValue} onChange={set('maturityValue')} step={1000} suffix="¥" />
            <NumField label={tx(L('Term (years)', '保险期间（年）'))} value={v.termYears} onChange={set('termYears')} />
          </div>
          <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-muted">{tx(L('Proposed new policy', '推荐的新保单'))}</p>
          <input aria-label={tx(L('New policy name', '新保单名称'))} value={v.newName} onChange={(e) => set('newName')(e.target.value)} className="min-h-[44px] w-full rounded-input border border-line px-3 text-[14px] text-ink" />
          <div className="grid grid-cols-2 gap-2">
            <NumField label={tx(L('Yearly premium', '年缴保费'))} value={v.newPremium} onChange={set('newPremium')} step={500} suffix="¥" />
            <NumField label={tx(L('Guaranteed return', '保证收益率'))} value={v.guaranteedPct} onChange={set('guaranteedPct')} step={0.1} suffix="%" />
            <NumField label={tx(L('"Illustrated" return', '“演示”收益率'))} value={v.illustratedPct} onChange={set('illustratedPct')} step={0.1} suffix="%" />
          </div>
          {v.illustratedPct > v.guaranteedPct && <Notice tone="warn">{tx(L(`Only ${v.guaranteedPct}% is guaranteed. The ${v.illustratedPct}% figure is an illustration, not a promise.`, `只有 ${v.guaranteedPct}% 是保证的，${v.illustratedPct}% 只是演示，不是承诺。`))}</Notice>}
        </div>
      </CardShell>

      <CardShell title={tx(L('What else changes if you switch', '换保还会带来哪些变化'))} icon="info">
        <ul className="space-y-1.5 text-[13px] leading-relaxed text-body">
          <li className="flex gap-2"><AppIcon name="clock" size={14} className="mt-1 shrink-0 text-warn" />{tx(L('Waiting periods start again (often 90–180 days for illness).', '等待期重新计算（疾病通常为 90–180 天）。'))}</li>
          <li className="flex gap-2"><AppIcon name="heart" size={14} className="mt-1 shrink-0 text-warn" />{tx(L(`At ${v.age}, new health questions apply. Conditions you have now may be excluded.`, `${v.age} 岁重新投保需要健康告知，现有疾病可能被除外。`))}</li>
          <li className="flex gap-2"><AppIcon name="coins" size={14} className="mt-1 shrink-0 text-warn" />{tx(L('The agent may earn a new first-year commission on the new policy.', '新保单首年佣金可能较高，销售人员有动力推荐换保。'))}</li>
        </ul>
      </CardShell>

      <CardShell title={tx(L('What did the seller say or do?', '销售人员说了或做了什么？'))} icon="user">
        <ul className="space-y-1">
          {FLAGS.map((f) => (
            <li key={f.id}>
              <label className="flex min-h-touch items-start gap-3 py-1 text-[14px] text-ink">
                <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--wb-primary)]" checked={!!flags[f.id]} onChange={(e) => setFlags({ ...flags, [f.id]: e.target.checked })} />
                {tx(f.text)}
              </label>
            </li>
          ))}
        </ul>
        {flags.refund && <div className="mt-2"><Notice tone="danger">{tx(L('"Full refund" agencies are a known scam pattern. They take fees and often move people into worse policies.', '“全额退保”代理是常见骗局，会收取费用，并常让人换成更差的保单。'))}</Notice></div>}
      </CardShell>

      <CardShell title={tx(L('Cooling-off period', '犹豫期'))} icon="clock">
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs text-muted">{tx(L('New policy signed on', '新保单签署日期'))}
            <input type="date" value={v.signedOn} onChange={(e) => set('signedOn')(e.target.value)} className="mt-0.5 min-h-[44px] w-full rounded-input border border-line bg-white px-3 text-[14px] text-ink" />
          </label>
          <NumField label={tx(L('Cooling-off days', '犹豫期天数'))} value={v.coolingDays} onChange={set('coolingDays')} suffix={tx(L('days', '天'))} />
        </div>
        <p className="mt-2 text-[14px] text-ink" aria-live="polite">
          {r.coolingLeft > 0
            ? <>{tx(L('You can still cancel the new policy for a full refund for', '您仍可在以下时间内全额退掉新保单：'))} <strong className="text-ok">{tx(L(`${r.coolingLeft} more days`, `还剩 ${r.coolingLeft} 天`))}</strong> ({date(addDays(v.signedOn, v.coolingDays))}).</>
            : tx(L('The cooling-off period has ended. Ask the insurer what can still be done.', '犹豫期已过，请向保险公司咨询还能如何处理。'))}
        </p>
        <p className="mt-1 text-xs text-muted">{tx(L('Often 15 days for long-term life policies in China. Check the exact days in the policy.', '国内长期寿险的犹豫期通常为 15 天，具体以保单为准。'))}</p>
      </CardShell>

      <section className="space-y-2">
        <h3 className="text-[16px] font-semibold text-ink">{tx(L('What you can do now', '现在可以做什么'))}</h3>
        <button type="button" className="btn-primary w-full" aria-expanded={share} onClick={() => setShare(!share)}><AppIcon name="user" size={18} />{tx(L('Share this with a family member', '分享给家人'))}</button>
        {share && (
          <div className="animate-fade-in rounded-input border border-cardline bg-white p-3">
            <p className="text-[13px] leading-relaxed text-ink" data-testid="switch-summary">{summary}</p>
            <button type="button" className="btn-secondary btn-compact mt-2" onClick={() => void copy()}>{copied ? tx(L('Copied', '已复制')) : tx(L('Copy message', '复制消息'))}</button>
          </div>
        )}
        <button type="button" className="btn-secondary w-full" onClick={() => { useAgentStore.getState().setDraft(tx(L('Talk to a licensed agent', '联系持牌顾问'))); navigate('/ask'); }}>{tx(L('Get a second opinion from a licensed agent', '请持牌顾问给第二意见'))}</button>
        <a href="tel:12378" className="btn-secondary w-full">{tx(L('Call the regulator\'s consumer hotline 12378', '拨打金融监管消费者热线 12378'))}</a>
        <p className="text-xs text-muted">{tx(L('Simplified estimate using guaranteed values only. WeWise can warn you but cannot stop a sale; this is not financial advice.', '仅按保证收益简化估算。微晓可以提醒，但无法阻止销售；以上并非理财建议。'))}</p>
      </section>
    </div>
  );
}

/** Compact version shown in chat, linking to the full check. */
export function SwitchCheckCard() {
  const { tx, money } = useTx();
  const r = computeSwitch(DEFAULT_SWITCH);
  return (
    <CardShell title={tx(L('Switching check (example numbers)', '换保检查（示例数字）'))} icon="info" tone="danger">
      <dl className="grid grid-cols-2 gap-3 text-[13px]">
        <div><dt className="text-xs text-muted">{tx(L('Lost if surrendered now', '现在退保损失'))}</dt><dd className="text-[20px]"><Money n={-r.loss} tone="danger" /></dd></div>
        <div><dt className="text-xs text-muted">{tx(L(`Keeping is better by (${r.yearsLeft} yrs)`, `继续持有更好（${r.yearsLeft} 年）`))}</dt><dd className="text-[20px]"><Money n={r.diff} tone="ok" /></dd></div>
      </dl>
      <ul className="mt-3 space-y-1 text-[13px] text-body">
        <li>· {tx(L(`Paid ${money(r.paid)}, would get back ${money(DEFAULT_SWITCH.surrenderValue)}`, `已交 ${money(r.paid)}，只能拿回 ${money(DEFAULT_SWITCH.surrenderValue)}`))}</li>
        <li>· {tx(L('Waiting periods and health questions start again', '等待期和健康告知重新开始'))}</li>
        <li>· {tx(L(`Cooling-off: ${r.coolingLeft} days left to cancel the new policy`, `犹豫期：还剩 ${r.coolingLeft} 天可退掉新保单`))}</li>
      </ul>
      <Link to="/switch-check" className="btn-primary mt-3 w-full">{tx(L('Open the full check with your numbers', '用您的数字做完整检查'))}</Link>
    </CardShell>
  );
}
