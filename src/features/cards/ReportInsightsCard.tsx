import { useState } from 'react';
import type { ReportFinding, Txt } from '@/engine/types';
import { L } from '@/engine/l';
import { Badge, CardShell, Notice } from '@/components/ui';
import { AppIcon } from '@/components/AppIcon';
import { RichText } from '../chat/CitationChip';
import { useTx } from '@/i18n/useTx';
import { useMemoryStore } from '../settings/memoryStore';

const STATUS = {
  ok: { tone: 'ok', label: L('Normal', '正常') },
  watch: { tone: 'warn', label: L('Keep an eye on', '需留意') },
  disclose: { tone: 'danger', label: L('Declare when applying', '投保时需告知') },
} as const;

interface Props { report: 'medical' | 'financial'; file: string; findings: ReportFinding[]; implications: Txt[]; memory: Txt[]; messageId?: string }

/** Medical / financial report analysis (PRD B1): findings with page refs, what they mean for cover, and an opt-in save to memory. */
export function ReportInsightsCard({ report, file, findings, implications, memory, messageId }: Props) {
  const { tx } = useTx();
  const add = useMemoryStore((s) => s.add);
  const [saved, setSaved] = useState(false);
  const save = () => { memory.forEach((m) => add(typeof m === 'string' ? { en: m, zh: m } : m)); setSaved(true); };

  return (
    <CardShell title={report === 'medical' ? tx(L('Health report: what it means for your cover', '体检报告对保障的影响')) : tx(L('Income and spending: what you can afford', '收入与支出：可负担范围'))} icon={report === 'medical' ? 'heart' : 'coins'}>
      <p className="flex items-center gap-1.5 text-xs text-muted"><AppIcon name="file" size={14} />{file} · <AppIcon name="lock" size={14} />{tx(L('personal details masked', '个人信息已脱敏'))}</p>
      <ul className="mt-3 divide-y divide-cardline rounded-input border border-cardline" data-testid="report-findings">
        {findings.map((f, i) => (
          <li key={i} className="px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted">{tx(f.label)}</p>
                <p className="text-[14px] font-semibold tabular-nums text-ink">{tx(f.value)}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="rounded-full bg-wash px-2 py-0.5 text-xs text-muted">p.{f.page}</span>
                <Badge tone={STATUS[f.status].tone} icon={f.status === 'ok' ? 'check' : 'info'}>{tx(STATUS[f.status].label)}</Badge>
              </div>
            </div>
            {f.note && <p className="mt-1 text-[13px] text-body">{tx(f.note)}</p>}
          </li>
        ))}
      </ul>
      <h4 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">{tx(L('What this means for your insurance', '对您保险的影响'))}</h4>
      <ul className="space-y-1.5 text-[13px] leading-relaxed text-body">
        {implications.map((m, i) => <li key={i} className="flex gap-2"><AppIcon name="arrow" size={14} className="mt-1 shrink-0 text-primary" /><span><RichText text={tx(m)} messageId={messageId} /></span></li>)}
      </ul>
      <div className="mt-4 rounded-input border border-cardline bg-surface p-3">
        <p className="text-xs font-semibold text-muted">{tx(L('Remember for next time?', '下次记住这些？'))}</p>
        <ul className="mt-1 space-y-0.5 text-[13px] text-ink">{memory.map((m, i) => <li key={i}>· {tx(m)}</li>)}</ul>
        {saved ? <p className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-ok"><AppIcon name="check" size={16} />{tx(L('Saved to Memory. You can delete it any time.', '已保存到记忆，可随时删除。'))}</p>
          : <button type="button" className="btn-secondary btn-compact mt-2" onClick={save}>{tx(L('Save to Memory', '保存到记忆'))}</button>}
      </div>
      {report === 'medical' && <div className="mt-3"><Notice tone="info">{tx(L('Not medical advice. Discuss the results themselves with a doctor.', '非医疗建议，检查结果本身请咨询医生。'))}</Notice></div>}
    </CardShell>
  );
}
