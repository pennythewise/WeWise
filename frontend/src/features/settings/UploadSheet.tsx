import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/components/AppIcon';
import { CardShell, Notice } from '@/components/ui';
import { L } from '@/engine/l';
import { useTx } from '@/i18n/useTx';
import { agentClient } from '@/engine';
import { useAgentStore } from '@/agentStore';

/** Policy upload screen (PRD §6.4), shown inside the app. Reading → Finding clauses → Checking → Ready then plays in chat as a live progress row. */
export function UploadPage() {
  const { t } = useTranslation();
  const { tx } = useTx();
  const navigate = useNavigate();
  const analyse = async (fixtureId: 'med_report' | 'fin_report') => {
    const name = fixtureId === 'med_report' ? 'health_screening_sep2026.pdf' : 'payslip_and_bank_statement_sep.pdf';
    const ref = await agentClient.uploadFile({ name, fixtureId });
    navigate('/ask');
    void useAgentStore.getState().send(fixtureId === 'med_report' ? tx(L('Analyse my health screening report', '分析我的体检报告')) : tx(L('Analyse my payslip and bank statement', '分析我的工资单和银行流水')), [ref]);
  };
  const run = async () => {
    const ref = await agentClient.uploadFile({ name: 'sample_policy_harbour.pdf', fixtureId: 'policy_sample' });
    navigate('/ask');
    void useAgentStore.getState().send(t('upload.sampleSend'), [ref]);
  };
  return (
    <div className="space-y-4" data-screen="upload">
      <CardShell>
        <div className="space-y-3">
          <p className="text-[13px] leading-relaxed text-body">{t('upload.desc')}</p>
          <button type="button" className="btn-primary w-full" onClick={run}><AppIcon name="scan" size={18} />{t('upload.sample')}</button>
          <button type="button" className="btn-secondary w-full" onClick={run}><AppIcon name="scan" size={18} />{t('upload.camera')}</button>
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">{['reading', 'finding', 'checking', 'ready'].map((k, i) => <li key={k}>{i > 0 && '→ '}{t(`upload.steps.${k}`)}</li>)}</ol>
        </div>
      </CardShell>
      <CardShell title={tx(L('Or analyse a report', '或分析一份报告'))} icon="heart">
        <div className="space-y-3">
          <p className="text-[13px] leading-relaxed text-body">{tx(L('I read medical or financial reports to see what they mean for your cover and what you can afford. Personal details are masked first.', '我会读取医疗或财务报告，告诉您它们对保障的影响以及可负担范围。个人信息会先脱敏。'))}</p>
          <button type="button" className="btn-secondary w-full" onClick={() => void analyse('med_report')} data-testid="analyse-med"><AppIcon name="heart" size={18} />{tx(L('Health screening report (sample)', '体检报告（示例）'))}</button>
          <button type="button" className="btn-secondary w-full" onClick={() => void analyse('fin_report')} data-testid="analyse-fin"><AppIcon name="coins" size={18} />{tx(L('Payslip and bank statement (sample)', '工资单和银行流水（示例）'))}</button>
        </div>
      </CardShell>
      <Notice tone="info">{t('upload.synthetic')}</Notice>
    </div>
  );
}
