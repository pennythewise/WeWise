import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/components/AppIcon';
import { Badge } from '@/components/ui';
import { InsurerMark } from '@/components/InsurerMark';
import { TYPE_ICON } from '@/components/typeMeta';
import { INSURERS, insurerById } from '@/mock/insurers';
import { POLICIES } from '@/mock/policies';
import type { InsuranceType } from '@/mock/products';
import { daysUntil } from '@/mock';
import { useTx } from '@/i18n/useTx';
import { useShopStore } from '@/features/shop/shopStore';
import { shopProductById } from '@/mock/shop';

const TYPES: InsuranceType[] = ['medical', 'accident', 'travel', 'motor', 'home'];

export function PolicyList() {
  const { t } = useTranslation();
  const { tx, date, lang, money } = useTx();
  const orders = useShopStore((s) => s.orders);
  const [type, setType] = useState<InsuranceType | 'all'>('all');
  const [insurer, setInsurer] = useState('all');
  const rows = POLICIES.filter((p) => (type === 'all' || p.type === type) && (insurer === 'all' || p.insurerId === insurer)).sort((a, b) => a.renewal.localeCompare(b.renewal));
  const chip = (on: boolean) => `min-h-[40px] rounded-full border px-3.5 text-[13px] font-medium ${on ? 'border-primary bg-primary text-white' : 'border-secline bg-white text-primary'}`;
  return (
    <div className="space-y-4" data-screen="policies">
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('policies.filterType')}>
        <button type="button" aria-pressed={type === 'all'} className={chip(type === 'all')} onClick={() => setType('all')}>{t('policies.all')}</button>
        {TYPES.map((x) => <button key={x} type="button" aria-pressed={type === x} className={chip(type === x)} onClick={() => setType(x)}>{t(`types.${x}`)}</button>)}
      </div>
      <label className="block text-xs font-medium text-muted">{t('policies.insurer')}
        <select value={insurer} onChange={(e) => setInsurer(e.target.value)} className="mt-1 min-h-[44px] w-full rounded-input border border-line bg-white px-3 text-[14px] text-ink">
          <option value="all">{t('policies.all')}</option>
          {INSURERS.filter((i) => POLICIES.some((p) => p.insurerId === i.id)).map((i) => <option key={i.id} value={i.id}>{lang === 'zh' ? i.zh : i.name}</option>)}
        </select>
      </label>
      {orders.length > 0 && (
        <ul className="space-y-3" aria-label={t('policies.purchased')}>
          {orders.map((o) => {
            const p = shopProductById(o.productId)!;
            return (
              <li key={o.id} className="card flex items-center gap-3 !p-3.5">
                <InsurerMark id={p.insurerId} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-ink">{tx(p.name)}</span>
                  <span className="block text-xs text-muted">{o.policyNo} · {money(o.premium)} {t(`shop.unit.${o.unit}`)}</span>
                  <span className="mt-1.5 flex flex-wrap gap-1.5"><Badge tone="ok" icon="check">{t('policies.purchased')}</Badge><Badge tone="info" icon="clock">{t('shop.checkout.start')} {date(o.startDate)}</Badge></span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-muted">{t('policies.sorted')}</p>
      <ul className="space-y-3">
        {rows.map((p) => {
          const d = daysUntil(p.renewal);
          return (
            <li key={p.id}>
              <Link to={`/policies/${p.id}`} className="card flex items-center gap-3 !p-3.5">
                <InsurerMark id={p.insurerId} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-ink">{tx(p.product)}</span>
                  <span className="block text-xs text-muted">{insurerById(p.insurerId).name} · {p.policyNo}</span>
                  <span className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge tone="neutral" icon={false}><AppIcon name={TYPE_ICON[p.type]} size={13} />{t(`types.${p.type}`)}</Badge>
                    <Badge tone={p.status === 'upcoming' ? 'info' : d <= 60 ? 'warn' : 'ok'} icon={p.status === 'upcoming' || d <= 60 ? 'clock' : 'check'}>{p.status === 'upcoming' ? t('home.startsIn', { n: daysUntil(p.inception) }) : t('home.renewsIn', { n: d })}</Badge>
                  </span>
                  <span className="mt-1 block text-xs text-muted">{t(p.status === 'upcoming' ? 'policies.coverEnds' : 'policies.renews')} {date(p.renewal)}</span>
                </span>
                <AppIcon name="chevron" size={18} />
              </Link>
            </li>
          );
        })}
      </ul>
      {rows.length === 0 && <p className="text-center text-[13px] text-muted">{t('policies.none')}</p>}
      <Link className="btn-secondary w-full" to="/upload">+ {t('home.addPolicy')}</Link>
    </div>
  );
}
