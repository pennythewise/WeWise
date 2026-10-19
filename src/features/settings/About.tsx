import { useTranslation } from 'react-i18next';
import { CardShell, Notice } from '@/components/ui';
import { useTx } from '@/i18n/useTx';
import { INSURER_DISCLAIMER } from '@/mock/insurers';

export function About() {
  const { t } = useTranslation();
  const { tx } = useTx();
  return (
    <div className="space-y-4" data-screen="about">
      <CardShell title={t('about.concept')} icon="spark"><p className="text-[14px] leading-[1.8] text-body">{t('about.conceptText')}</p><p className="mt-2 text-[14px] font-semibold text-brand">{t('brand.taglineZh')}</p></CardShell>
      <CardShell title={t('about.how')} icon="shield">
        <ol className="list-decimal space-y-1.5 pl-5 text-[14px] leading-relaxed text-body">{(t('about.steps', { returnObjects: true }) as string[]).map((s, i) => <li key={i}>{s}</li>)}</ol>
      </CardShell>
      <Notice tone="warn">{t('about.notOfficial')}</Notice>
      <Notice tone="info">{tx(INSURER_DISCLAIMER)} {t('about.synthetic')}</Notice>
      <p className="text-[11px] leading-relaxed text-muted">3D car: "2024 Xiaomi SU7 Max" by Ddiaz Design (sketchfab.com/ddiaz-design), CC-BY-NC-SA-4.0. 3D drone: "DJI Air 3" by polyman (sketchfab.com/Polyman_3D), CC-BY-4.0.</p>
    </div>
  );
}
