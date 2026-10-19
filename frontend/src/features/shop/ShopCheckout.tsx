import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { InsurerMark } from '@/components/InsurerMark';
import { CardShell, Notice, StepIndicator } from '@/components/ui';
import { addDays, DEMO_TODAY } from '@/engine/l';
import { USER } from '@/mock/users';
import { CATEGORIES, defaultAnswers, quote, shopProductById } from '@/mock/shop';
import { useTx } from '@/i18n/useTx';
import { useShopStore, type Order } from './shopStore';

const METHODS = ['wechat', 'alipay', 'card'] as const;
const field = 'mt-1 min-h-[44px] w-full rounded-input border border-line bg-white px-3 text-[14px] text-ink';

/** Mock checkout: confirm details → pay (simulated) → policy issued. No real payment or insurer call is made. */
export function ShopCheckout() {
  const { id } = useParams();
  const p = shopProductById(id ?? '');
  const { t } = useTranslation();
  const { tx, money, date } = useTx();
  const navigate = useNavigate();
  const answers = useShopStore((s) => (p ? s.quotes[p.type] : undefined));
  const orderCount = useShopStore((s) => s.orders.length);
  const addOrder = useShopStore((s) => s.addOrder);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [start, setStart] = useState(addDays(DEMO_TODAY, 1));
  const [agreed, setAgreed] = useState(false);
  const [declared, setDeclared] = useState(false);
  const [method, setMethod] = useState<(typeof METHODS)[number]>('wechat');
  const [paying, setPaying] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!p) return <Navigate to="/shop" replace />;

  const cat = CATEGORIES[p.type];
  const a = answers ?? defaultAnswers(p.type);
  const premium = quote(p, a);
  const unit = t(`shop.unit.${cat.unit}`);
  const startOk = start >= addDays(DEMO_TODAY, 1) && start <= addDays(DEMO_TODAY, 90);
  const canNext = agreed && startOk && (!cat.needsDeclaration || declared);

  const pay = () => {
    if (paying) return;
    setPaying(true);
    timer.current = setTimeout(() => {
      const o: Order = { id: `ord_${p.id}_${orderCount + 1}`, productId: p.id, type: p.type, premium, unit: cat.unit, answers: a, startDate: start, policyNo: `WW-2026-${String(48210 + orderCount * 37).padStart(6, '0')}`, method };
      addOrder(o);
      setOrder(o);
      setPaying(false);
      setStep(3);
    }, 1200);
  };

  return (
    <div className="space-y-4" data-screen="shopCheckout">
      <StepIndicator label={t('shop.checkout.steps')} steps={[t('shop.checkout.s1'), t('shop.checkout.s2'), t('shop.checkout.s3')]} current={step} />

      <section className="card flex items-center gap-3 !p-3.5">
        <InsurerMark id={p.insurerId} />
        <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold text-ink">{tx(p.name)}</span><span className="text-xs text-muted">{t(`types.${p.type}`)}</span></span>
        <span className="shrink-0 whitespace-nowrap text-right text-[18px] font-semibold text-primary">{money(premium)}<span className="block text-[11px] font-normal text-muted">{unit}</span></span>
      </section>

      {step === 1 && (
        <>
          <CardShell title={t('shop.checkout.applicant')} icon="user">
            <dl className="space-y-2 text-[14px]">
              <div className="flex justify-between"><dt className="text-muted">{t('shop.checkout.name')}</dt><dd className="font-medium text-ink">{USER.maskedName}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">{t('shop.checkout.phone')}</dt><dd className="font-medium text-ink">{USER.maskedPhone}</dd></div>
            </dl>
            <label className="mt-3 block text-xs font-medium text-muted">{t('shop.checkout.start')}
              <input type="date" className={field} value={start} min={addDays(DEMO_TODAY, 1)} max={addDays(DEMO_TODAY, 90)} onChange={(e) => setStart(e.target.value)} aria-invalid={!startOk} />
            </label>
            {!startOk && <p className="mt-1 text-xs text-danger" role="alert">{t('shop.checkout.startRange')}</p>}
          </CardShell>
          {cat.needsDeclaration && (
            <label className="flex items-start gap-3 text-[13px] leading-relaxed text-body">
              <input type="checkbox" checked={declared} onChange={(e) => setDeclared(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-primary" />{t('shop.checkout.declaration')}
            </label>
          )}
          <label className="flex items-start gap-3 text-[13px] leading-relaxed text-body">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-primary" />{t('shop.checkout.agree')}
          </label>
          <button type="button" className="btn-primary w-full" disabled={!canNext} onClick={() => setStep(2)}>{t('shop.checkout.next')}</button>
        </>
      )}

      {step === 2 && (
        <>
          <CardShell title={t('shop.checkout.method')} icon="wallet">
            <div role="radiogroup" aria-label={t('shop.checkout.method')} className="space-y-2">
              {METHODS.map((m) => (
                <label key={m} className={`flex min-h-[48px] items-center gap-3 rounded-control border px-3 text-[14px] ${method === m ? 'border-primary bg-bluewash' : 'border-line'}`}>
                  <input type="radio" name="method" checked={method === m} onChange={() => setMethod(m)} className="accent-primary" />{t(`shop.checkout.methods.${m}`)}
                </label>
              ))}
            </div>
          </CardShell>
          <Notice tone="info">{t('shop.checkout.mockNote')}</Notice>
          <button type="button" className="btn-primary w-full" disabled={paying} onClick={pay}>{paying ? t('shop.checkout.paying') : t('shop.checkout.pay', { amount: money(premium) })}</button>
          <button type="button" className="btn-secondary w-full" disabled={paying} onClick={() => setStep(1)}>{t('shop.checkout.back')}</button>
        </>
      )}

      {step === 3 && order && (
        <>
          <Notice tone="ok" icon="check"><span role="status"><strong className="block text-ink">{t('shop.checkout.doneTitle')}</strong>{t('shop.checkout.doneText', { date: date(order.startDate) })}</span></Notice>
          <CardShell>
            <dl className="space-y-2 text-[14px]">
              <div className="flex justify-between"><dt className="text-muted">{t('shop.checkout.policyNo')}</dt><dd className="font-medium text-ink">{order.policyNo}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">{t('shop.checkout.paid')}</dt><dd className="font-medium text-ink">{money(order.premium)} {unit}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">{t('shop.checkout.start')}</dt><dd className="font-medium text-ink">{date(order.startDate)}</dd></div>
            </dl>
          </CardShell>
          <Link to="/policies" className="btn-primary w-full">{t('shop.viewPolicies')}</Link>
          <button type="button" className="btn-secondary w-full" onClick={() => navigate('/shop')}>{t('shop.checkout.keepShopping')}</button>
        </>
      )}
    </div>
  );
}
