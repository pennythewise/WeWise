import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sheet } from '@/components/Sheet';
import { AppIcon } from '@/components/AppIcon';
import { Notice } from '@/components/ui';
import { agentClient } from '@/engine';
import { useAgentStore } from '@/agentStore';
import { useUiStore } from '@/store';

/** Policy upload entry (PRD §6.4). Reading → Finding clauses → Checking → Ready then plays in chat as a live progress row. */
export function UploadSheet() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { uploadOpen, setUploadOpen } = useUiStore();
  const run = async () => {
    setUploadOpen(false);
    const ref = await agentClient.uploadFile({ name: 'sample_policy_harbour.pdf', fixtureId: 'policy_sample' });
    navigate('/ask');
    void useAgentStore.getState().send(t('upload.sampleSend'), [ref]);
  };
  return (
    <Sheet open={uploadOpen} onOpenChange={setUploadOpen} side="bottom" height="auto" title={t('upload.title')}>
      <div className="space-y-3 p-4">
        <p className="text-[13px] leading-relaxed text-body">{t('upload.desc')}</p>
        <button type="button" className="btn-primary w-full" onClick={run}><AppIcon name="scan" size={18} />{t('upload.sample')}</button>
        <button type="button" className="btn-secondary w-full" onClick={run}><AppIcon name="scan" size={18} />{t('upload.camera')}</button>
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">{['reading', 'finding', 'checking', 'ready'].map((k, i) => <li key={k}>{i > 0 && '→ '}{t(`upload.steps.${k}`)}</li>)}</ol>
        <Notice tone="info">{t('upload.synthetic')}</Notice>
      </div>
    </Sheet>
  );
}
