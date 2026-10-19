import { useNavigate } from 'react-router-dom';
import { L } from '@/engine/l';
import { AppIcon } from '@/components/AppIcon';
import { Badge, CardShell, Notice } from '@/components/ui';
import { useAgentStore } from '@/agentStore';
import { useTx } from '@/i18n/useTx';
import { useTranslation } from 'react-i18next';
import { useCrossBorderStore, XB_STEPS } from './crossBorderStore';

const KIT = [
  L('English summary of the incident', '事件英文摘要'),
  L('Original Thai bill and discharge note', '泰文账单和出院小结原件'),
  L('English and Chinese translations', '英文和中文译文'),
  L('Claim form, pre-filled for your review', '预填的理赔表格，待您核对'),
];

/** Progress of the cross-border claim as reached in the S3 chat (see crossBorderStore). Preparation only. */
export function useXbProgress() {
  const done = useCrossBorderStore((s) => s.done);
  const reached = XB_STEPS.map((s) => s.key in done);
  const count = reached.filter(Boolean).length;
  return { done, reached, count, total: XB_STEPS.length, started: count > 0 };
}

export function CrossBorderClaim() {
  const { tx, lang } = useTx();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { done, reached, count, total, started } = useXbProgress();
  const current = reached.findIndex((r) => !r);
  const prepare = () => { navigate('/ask'); void useAgentStore.getState().send(tx(L('Prepare my claim kit', '准备我的理赔资料包'))); };
  const start = () => { navigate('/ask'); void useAgentStore.getState().send(tx(L('What should I do right now?', '我现在该怎么办？'))); };

  const facts = [
    { label: L('Country', '国家'), value: L('Thailand (Phuket)', '泰国（普吉）') },
    { label: L('Hospital', '医院'), value: L('Riverside International Hospital', '河畔国际医院') },
    ...(done.docs ? [{ label: L('Admitted', '入院'), value: L('22 Dec 2026', '2026 年 12 月 22 日') }] : []),
    ...(done.estimate ? [{ label: L('Discharged', '出院'), value: L('25 Dec 2026 (corrected from 20 Dec)', '2026 年 12 月 25 日（由 12 月 20 日更正）') }, { label: L('Billed', '账单'), value: L('210,000 THB ≈ ¥42,000 (demo rate, estimate)', '210,000 泰铢 ≈ ¥42,000（演示汇率，估算）') }] : []),
  ];

  return (
    <>
      <CardShell title={tx(L('Overseas incident', '境外事件'))} icon="plane">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[13px]">
          {facts.map((f, i) => <div key={i} className={f.label.en === 'Billed' || f.label.en === 'Hospital' ? 'col-span-2' : ''}><dt className="text-xs text-muted">{tx(f.label)}</dt><dd className="font-medium text-ink">{tx(f.value)}</dd></div>)}
        </dl>
        {!started && <p className="mt-3 text-[13px] text-body">{tx(L('Nothing has happened yet. Tell the assistant what happened and this claim fills in as it works with your insurer and the hospital.', '尚未开始。告诉助手发生了什么，它与保险公司和医院对接时，这里会同步更新。'))}</p>}
        {!started && <button type="button" className="btn-secondary mt-3 w-full" onClick={start}>{tx(L('Tell the assistant what happened', '告诉助手发生了什么'))}</button>}
      </CardShell>

      <CardShell title={tx(L('How an overseas claim works', '境外理赔如何进行'))} icon="clock">
        <p className="mb-3 text-[13px] leading-relaxed text-body">{tx(L('Your insurer\'s assistance team deals with the hospital first and can guarantee payment, so you are not left to pay and chase. The claim review comes afterwards.', '保险公司救援团队会先与医院对接并可出具付款担保，您不必先垫付再追款。理赔审核在之后进行。'))}</p>
        <ol className="relative" aria-label={t('claims.timeline')}>
          {XB_STEPS.map((s, i) => {
            const isDone = reached[i];
            const isCurrent = started && i === current;
            const last = i === XB_STEPS.length - 1;
            return (
              <li key={s.key} className="relative flex gap-3 pb-4 last:pb-0" aria-current={isCurrent ? 'step' : undefined}>
                {!last && <span className={`absolute left-[11px] top-6 h-[calc(100%-12px)] w-0.5 ${isDone ? 'bg-primary' : 'bg-[#D6DFF2]'}`} aria-hidden="true" />}
                <span className={`z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${isDone ? 'bg-primary text-white' : 'border-2 border-[#C9D3EC] bg-white text-muted'}`}>
                  {isDone ? <AppIcon name="check" size={13} strokeWidth={2} /> : <span className="h-1.5 w-1.5 rounded-full bg-[#C9D3EC]" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className={`text-[14px] font-semibold leading-snug ${isDone ? 'text-ink' : 'text-muted'}`}>{tx(s.label)}</p>
                    <Badge tone={s.actor === 'you' ? 'info' : s.actor === 'ai' ? 'ok' : 'neutral'} icon={false}>{t(`claims.actor.${s.actor}`)}</Badge>
                    {isCurrent && <Badge tone="warn" icon="clock">{t('claims.now')}</Badge>}
                  </div>
                  {(isDone || s.key === 'review' || s.key === 'payout') && <p className="mt-0.5 text-[13px] text-body">{tx(s.note)}</p>}
                </div>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-xs text-muted" lang={lang}>{count} / {total}</p>
      </CardShell>

      {done.kit && (
        <CardShell title={tx(L('Claim kit', '理赔资料包'))} icon="file">
          <ul className="space-y-1.5">{KIT.map((k, i) => <li key={i} className="flex items-start gap-2 text-[13px] text-body"><AppIcon name="check" size={14} className="mt-0.5 shrink-0 text-ok" />{tx(k)}</li>)}</ul>
          <div className="mt-3"><Notice tone="info">{tx(L('Preparation only. The kit is saved for you to download; you submit it through your insurer\'s official channel.', '仅为准备阶段。资料包保存供您下载，由您通过保险公司官方渠道提交。'))}</Notice></div>
        </CardShell>
      )}
      {started && !done.kit && done.estimate && <button type="button" className="btn-secondary w-full" onClick={prepare}>{tx(L('Review and download the kit', '核对并下载资料包'))}</button>}
    </>
  );
}
