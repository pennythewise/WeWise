import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CardShell } from '@/components/ui';
import { insurerById } from '@/mock/insurers';
import { policyById } from '@/mock/policies';
import { useTx } from '@/i18n/useTx';
import { useExtractionStore } from './extractionStore';

export function PolicySummaryCard({ policyId }: { policyId: string }) {
  const { t } = useTranslation();
  const { tx, money, date } = useTx();
  const fixed = useExtractionStore((s) => s.corrections);
  const p = policyById(policyId);
  if (!p) return null;
  const ins = insurerById(p.insurerId);
  return (
    <CardShell title={tx(p.product)} icon="shield" right={<span className="text-xs text-muted">{ins.name}</span>}>
      <dl className="space-y-1.5 text-[13px]">
        <Row k={t('cards.summary.limit')} v={fixed.annual_limit ?? money(p.coverAmount)} />
        <Row k={t('cards.summary.deductible')} v={money(p.deductible)} />
        <Row k={t('cards.summary.copay')} v={`${p.coPayPct}%`} />
        <Row k={t('cards.summary.waiting')} v={t('cards.summary.days', { n: p.waitingDays })} />
        <Row k={t('cards.summary.renewal')} v={date(p.renewal)} />
      </dl>
      <Link to={`/policies/${p.id}`} className="mt-3 inline-flex min-h-touch items-center text-[13px] font-semibold text-primary">{t('cards.summary.open')}</Link>
    </CardShell>
  );
}
const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="text-right font-semibold text-ink">{v}</dd></div>
);
