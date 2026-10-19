import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/components/AppIcon';
import { CardShell, Notice, ProgressBar, Skeleton, StepIndicator } from '@/components/ui';
import { ConfirmActionCard } from '../cards/ConfirmActionCard';
import { policyById } from '@/mock/policies';
import { useTx } from '@/i18n/useTx';
import { useAgentStore } from '@/agentStore';
import { claimActions, findConfirmCard } from './claimActions';
import { DocRow } from './DocRow';
import { ClaimAgents } from './ClaimAgents';
import { preparedCount, requiredCount, useClaimStore } from './claimStore';

/** 准备理赔材料 / Prepare claim documents: ① Confirm policy ② Prepare documents ③ Review & submit (PRD §6.8). */
export function ClaimPrepare() {
  const { t } = useTranslation();
  const { tx, money } = useTx();
  const { docs, step, setStep, sheetOpen: sheet, setSheetOpen: setSheet } = useClaimStore();
  const running = useAgentStore((s) => s.running);
  const pol = policyById('pol_mei_health_01')!;
  const n = preparedCount(docs), total = requiredCount(docs);
  const allConfirmed = docs.filter((d) => d.required).every((d) => d.state === 'confirmed' && !d.warning);
  useAgentStore((s) => s.messages); // re-render when the confirm card arrives
  const card = sheet ? findConfirmCard('act_claim_submit') : null;

  const submit = async () => {
    setSheet(true);
    await claimActions.validate();
  };

  const Cta = ({ children }: { children: React.ReactNode }) => (
    <div className="sticky bottom-0 -mx-4 -mb-4 mt-4 flex gap-2.5 border-t border-[#EDF0F5] bg-white/95 px-5 pb-[15px] pt-3 backdrop-blur">{children}</div>
  );

  return (
    <div data-screen="claimPrepare">
      <StepIndicator label={t('claims.steps.label')} current={step} steps={[t('claims.steps.policy'), t('claims.steps.docs'), t('claims.steps.review')]} />
      <h2 className="mt-4 text-[21px] font-semibold leading-snug text-ink">{t(`claims.steps.title${step}`)}</h2>

      {step === 1 && (
        <div className="mt-3 space-y-3">
          <CardShell>
            <p className="text-[15px] font-semibold text-ink">{tx(pol.product)}</p>
            <dl className="mt-2 space-y-1.5 text-[13px]">
              <div className="flex justify-between"><dt className="text-muted">{t('claims.incident')}</dt><dd className="font-semibold text-ink">{t('claims.incidentValue')}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">{t('cards.summary.limit')}</dt><dd className="font-semibold text-ink">{money(pol.coverAmount)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">{t('cards.summary.deductible')}</dt><dd className="font-semibold text-ink">{money(pol.deductible)}</dd></div>
            </dl>
          </CardShell>
          <Notice tone="info">{t('claims.changeInvalidates')}</Notice>
          <Cta><button type="button" className="btn-primary flex-1" onClick={() => setStep(2)}>{t('claims.continue')}</button></Cta>
        </div>
      )}

      {step === 2 && (
        <div className="mt-3 space-y-3">
          <ClaimAgents />
          <div className="flex items-center justify-between text-[14px]"><span className="font-semibold text-ink">{t('claims.preparedLabel')}</span><span className="font-semibold text-brand" aria-live="polite">{t('claims.prepared', { n, total })}</span></div>
          <ProgressBar value={n} max={total} tone={n === total ? 'ok' : 'info'} label={t('claims.prepared', { n, total })} />
          <ul className="rounded-card border border-[#E2E9F4] bg-white">{docs.map((d) => <DocRow key={d.id} doc={d} />)}</ul>
          {!allConfirmed && <p className="text-xs text-muted">{t('claims.confirmAllHint')}</p>}
          <Notice tone="info" icon="info">{t('claims.riskNotice')}</Notice>
          <Cta>
            <button type="button" className="btn-secondary" onClick={() => setStep(1)}>{t('claims.back')}</button>
            <button type="button" className="btn-primary flex-1" disabled={!allConfirmed} onClick={() => setStep(3)}>{t('claims.reviewContinue')}</button>
          </Cta>
        </div>
      )}

      {step === 3 && (
        <div className="mt-3 space-y-3">
          <ul className="divide-y divide-cardline rounded-card border border-[#E4E9F2] bg-white px-4 text-[13px]">
            {docs.filter((d) => d.state === 'confirmed').map((d) => <li key={d.id} className="flex items-center justify-between gap-3 py-2.5"><span className="text-muted">{tx(d.name)}</span><span className="flex items-center gap-1 font-semibold text-ok"><AppIcon name="check" size={14} strokeWidth={2} />{t('claims.doc.confirmed')}</span></li>)}
            <li className="flex items-center justify-between gap-3 py-2.5"><span className="text-muted">{t('claims.total')}</span><span className="font-semibold tabular-nums text-ink">¥18,420</span></li>
          </ul>
          <div className="flex items-center gap-3 rounded-card border border-line bg-surface p-3.5">
            <AppIcon name="lock" />
            <div><p className="text-xs text-muted">{t('cards.confirm.payout')}</p><p className="text-[15px] font-semibold tabular-nums text-ink">•••• •••• 4821</p><p className="text-xs text-muted">{t('claims.payoutLocked')}</p></div>
          </div>
          <Notice tone="warn">{t('claims.riskNotice')}</Notice>
          {sheet ? (
            <div className="animate-fade-in space-y-2" data-testid="submit-confirm">
              {card ? <ConfirmActionCard {...card.data} /> : <CardShell title={t('cards.confirm.title')} icon="lock"><div className="space-y-2"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-16" /><Skeleton className="h-10" /></div></CardShell>}
              <button type="button" className="btn-secondary w-full" onClick={() => setSheet(false)}>{t('claims.back')}</button>
            </div>
          ) : (
            <Cta>
              <button type="button" className="btn-secondary" onClick={() => setStep(2)}>{t('claims.back')}</button>
              <button type="button" className="btn-primary flex-1" disabled={running} onClick={submit}>{t('claims.confirmSubmission')}</button>
            </Cta>
          )}
        </div>
      )}
    </div>
  );
}
