import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AppIcon, type IconName } from '@/components/AppIcon';
import { Badge, CardShell, Segmented } from '@/components/ui';
import { LanguageSwitch } from './LanguageSwitch';
import { USER } from '@/mock/users';
import { POLICIES } from '@/mock/policies';
import { CLAIMS } from '@/mock/claims';
import { DEMO_TODAY, daysBetween } from '@/engine/l';
import { L } from '@/engine/l';
import { useTx } from '@/i18n/useTx';
import { useProfileData } from './profileApi';

type Autonomy = 'ask' | 'confirm' | 'auto';

const SWITCH = "h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-[#C9D3EC] transition-colors checked:bg-primary [&::before]:m-0.5 [&::before]:block [&::before]:h-5 [&::before]:w-5 [&::before]:rounded-full [&::before]:bg-white [&::before]:transition-transform [&::before]:content-[''] checked:[&::before]:translate-x-5";

const AUTONOMY: { id: Autonomy; label: L; hint: L }[] = [
  { id: 'ask', label: L('Ask me', '每次询问'), hint: L('WeWise proposes; you approve every step.', '微晓只提出建议，每一步都由你确认。') },
  { id: 'confirm', label: L('Confirm key', '关键确认'), hint: L('Reads and drafts on its own; asks before anything is sent, paid or changed.', '读取与起草自动完成；发送、付款、变更前先问你。') },
  { id: 'auto', label: L('Routine auto', '常规自动'), hint: L('Handles routine reminders and renewals; money and claims still need you.', '常规提醒与续保自动办理；涉及资金与理赔仍需你确认。') },
];

const CAPS: { id: string; label: L; hint: L; on: boolean }[] = [
  { id: 'read', label: L('Read my policies', '读取我的保单'), hint: L('Search clauses and check coverage.', '检索条款、核对保障。'), on: true },
  { id: 'docs', label: L('Read uploaded documents', '读取上传的文件'), hint: L('OCR and extract fields; you confirm them.', '识别并提取字段，由你确认。'), on: true },
  { id: 'claim', label: L('Prepare claims', '准备理赔材料'), hint: L('Build the checklist and draft the claim.', '生成材料清单并起草理赔申请。'), on: true },
  { id: 'contact', label: L('Contact insurers for me', '代我联系保险公司'), hint: L('Calls and messages to the insurer.', '向保险公司致电或发送消息。'), on: false },
];

const ALERTS: { id: string; label: L; on: boolean }[] = [
  { id: 'renew', label: L('Renewal reminders', '续保提醒'), on: true },
  { id: 'claim', label: L('Claim progress', '理赔进度'), on: true },
  { id: 'gap', label: L('Coverage gap alerts', '保障缺口提醒'), on: true },
  { id: 'promo', label: L('Offers and recommendations', '优惠与推荐'), on: false },
];

function Toggle({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-touch items-center justify-between gap-3 py-1.5">
      <span className="min-w-0">
        <span className="block text-[14px] font-medium text-ink">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" checked={on} onChange={(e) => onChange(e.target.checked)} className={SWITCH} aria-label={label} />
    </label>
  );
}

function NavRow({ to, icon, label, hint, right }: { to: string; icon: IconName; label: string; hint?: string; right?: ReactNode }) {
  return (
    <Link to={to} className="flex min-h-touch items-center gap-3 py-2">
      <span className="text-brand"><AppIcon name={icon} size={20} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium text-ink">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      {right}
      <span className="text-muted"><AppIcon name="chevron" size={16} /></span>
    </Link>
  );
}

/** Profile: who I am, how much the assistant may do on my behalf, what it can touch, how I am alerted, and my data rights. */
export function ProfilePage() {
  const { tx } = useTx();
  const [autonomy, setAutonomy] = useState<Autonomy>('confirm');
  const [caps, setCaps] = useState(() => Object.fromEntries(CAPS.map((c) => [c.id, c.on])));
  const [alerts, setAlerts] = useState(() => Object.fromEntries(ALERTS.map((a) => [a.id, a.on])));
  const [mask, setMask] = useState(true);
  const [confirmPay, setConfirmPay] = useState(true);
  const { data, setMemoryEnabled } = useProfileData();
  const level = AUTONOMY.find((a) => a.id === autonomy)!;
  const t = (en: string, zh: string) => tx(L(en, zh));
  const name = USER.name;
  const purpose = (p: string) => p.replace(/_/g, ' ');

  return (
    <div className="space-y-4" data-screen="profile">
      <CardShell>
        <p className="mb-2 text-[11px] text-muted">{data.live ? t('Live: private synthetic workspace', '已连接：私有合成工作区') : t('Offline demo values', '离线演示数据')}</p>
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-[20px] font-semibold text-white">{name.slice(0, 1).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-semibold text-ink">{name}</p>
            <p className="truncate text-xs tabular-nums text-muted">{`${USER.maskedPhone} · ${tx(USER.city)}`}</p>
          </div>
          <Badge tone="ok" icon="check">{t('Verified', '已实名')}</Badge>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 border-t border-cardline pt-3 text-center">
          <div><p className="text-[17px] font-semibold tabular-nums text-ink">{POLICIES.length}</p><p className="text-[11px] text-muted">{t('Policies', '保单')}</p></div>
          <div><p className="text-[17px] font-semibold tabular-nums text-ink">{POLICIES.filter((p) => daysBetween(DEMO_TODAY, p.renewal) <= 30).length}</p><p className="text-[11px] text-muted">{t('Renewals due', '临近续保')}</p></div>
          <div><p className="text-[17px] font-semibold tabular-nums text-ink">{CLAIMS.length}</p><p className="text-[11px] text-muted">{t('Claims', '理赔')}</p></div>
        </div>
      </CardShell>

      <CardShell title={t('WeWise assistant', '微晓助手')} icon="spark">
        <p className="mb-2 text-[13px] font-medium text-ink">{t('How much may it do on its own?', '允许它自行处理到什么程度？')}</p>
        <Segmented<Autonomy> value={autonomy} onChange={setAutonomy} label={t('Autonomy level', '自主程度')} options={AUTONOMY.map((a) => ({ id: a.id, label: tx(a.label) }))} />
        <p className="mt-2 text-xs text-muted" aria-live="polite">{tx(level.hint)}</p>
        <div className="mt-3 divide-y divide-cardline border-t border-cardline">
          {CAPS.map((c) => <Toggle key={c.id} label={tx(c.label)} hint={tx(c.hint)} on={caps[c.id]} onChange={(v) => setCaps({ ...caps, [c.id]: v })} />)}
        </div>
        {data.memoryEnabled !== undefined && (
          <div className="border-t border-cardline">
            <Toggle label={t('Approved memory', '已授权的记忆')} hint={t('Only preferences you approve are remembered and reused.', '只记住并复用你授权的偏好。')} on={data.memoryEnabled} onChange={setMemoryEnabled} />
          </div>
        )}
        <div className="border-t border-cardline">
          <NavRow to="/memory" icon="lock" label={t('Memory and access log', '记忆与访问记录')} hint={t('What it remembers and every tool it used', '它记住了什么、调用过哪些工具')} />
        </div>
      </CardShell>

      <CardShell title={t('Insurance', '保险')} icon="shield">
        <div className="divide-y divide-cardline">
          <NavRow to="/policies" icon="wallet" label={t('My policies and insurers', '我的保单与保险公司')} />
          <NavRow to="/upload" icon="upload" label={t('Add a policy', '添加保单')} />
          <NavRow to="/emergency" icon="phone" label={t('Emergency contacts', '紧急联系')} />
        </div>
      </CardShell>

      <CardShell title={t('Notifications', '通知')} icon="bell">
        <div className="divide-y divide-cardline">
          {ALERTS.map((a) => <Toggle key={a.id} label={tx(a.label)} on={alerts[a.id]} onChange={(v) => setAlerts({ ...alerts, [a.id]: v })} />)}
        </div>
      </CardShell>

      <CardShell title={t('Privacy and safety', '隐私与安全')} icon="lock">
        <div className="divide-y divide-cardline">
          <Toggle label={t('Mask personal data', '隐去个人敏感信息')} hint={t('ID, phone and card numbers are hidden before reaching the model.', '身份证、手机号、卡号在送入模型前先打码。')} on={mask} onChange={setMask} />
          <Toggle label={t('Always confirm payments', '付款一律确认')} hint={t('Slide to confirm, whatever the autonomy level.', '无论自主程度如何，都需滑动确认。')} on={confirmPay} onChange={setConfirmPay} />
        </div>
        {data.consents.length > 0 && (
          <div className="border-t border-cardline pt-2">
            <p className="mb-1 text-[13px] font-medium text-ink">{t('Consents on record', '已记录的授权')}</p>
            <ul className="space-y-1">
              {data.consents.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 text-xs text-muted">
                  <span className="truncate">{purpose(c.purpose)}</span>
                  <Badge tone={c.granted ? 'ok' : 'neutral'}>{c.granted ? t('Granted', '已授权') : t('Withdrawn', '已撤回')}</Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="border-t border-cardline">
          <NavRow to="/about" icon="info" label={t('Data export and deletion', '数据导出与删除')} hint={t('Not available in this demo', '演示版暂未开放')} />
        </div>
      </CardShell>

      <CardShell title={t('Preferences', '偏好')} icon="user">
        <div className="flex min-h-touch items-center justify-between gap-3">
          <span className="text-[14px] font-medium text-ink">{t('Language', '语言')}</span>
          <LanguageSwitch />
        </div>
        <div className="border-t border-cardline">
          <NavRow to="/about" icon="info" label={t('About WeWise', '关于微晓')} />
        </div>
      </CardShell>
    </div>
  );
}
