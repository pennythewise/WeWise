import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/components/AppIcon';
import { Badge } from '@/components/ui';
import { InsurerMark } from '@/components/InsurerMark';
import { TYPE_ICON } from '@/components/typeMeta';
import { insurerById } from '@/mock/insurers';
import { clausesFor } from '@/mock/clauses';
import type { Policy } from '@/mock/policies';
import { daysUntil } from '@/mock';
import { useTx } from '@/i18n/useTx';

/** Swipeable "digital twin" of a policy: front = key numbers, back = key clauses. Subtle pointer tilt (P2 parallax). */
export function PolicyTwinCard({ policy: p }: { policy: Policy }) {
  const { t } = useTranslation();
  const { tx, money, lang } = useTx();
  const reduce = useReducedMotion();
  const [flipped, setFlipped] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const days = daysUntil(p.renewal);
  const start = daysUntil(p.inception);
  const key = clausesFor(p.id).filter((c) => c.type !== 'condition').slice(0, 3);
  const ins = insurerById(p.insurerId);

  return (
    <div
      className="w-[272px] shrink-0 snap-center [perspective:900px]"
      onPointerMove={(e) => {
        if (reduce || e.pointerType !== 'mouse') return;
        const r = e.currentTarget.getBoundingClientRect();
        setTilt({ x: ((e.clientY - r.top) / r.height - 0.5) * -6, y: ((e.clientX - r.left) / r.width - 0.5) * 8 });
      }}
      onPointerLeave={() => setTilt({ x: 0, y: 0 })}
    >
      <motion.div animate={{ rotateY: flipped ? 180 : 0, rotateX: tilt.x, rotateZ: 0 }} transition={{ duration: reduce ? 0 : 0.35 }} style={{ transformStyle: 'preserve-3d' }} className="relative h-[250px]">
        <div className="card absolute inset-0 flex flex-col [backface-visibility:hidden]" style={{ transform: `rotateY(${tilt.y}deg)` }} aria-hidden={flipped}>
          <div className="flex items-center gap-2.5">
            <InsurerMark id={p.insurerId} />
            <div className="min-w-0 flex-1"><p className="truncate text-[15px] font-semibold text-ink">{tx(p.product)}</p><p className="text-xs text-muted">{lang === 'zh' ? ins.zh : ins.name}</p></div>
            <span className="text-brand"><AppIcon name={TYPE_ICON[p.type]} size={26} /></span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[13px]">
            <div><dt className="text-xs text-muted">{t('cards.summary.limit')}</dt><dd className="font-semibold text-ink">{money(p.coverAmount)}</dd></div>
            <div><dt className="text-xs text-muted">{t('cards.summary.deductible')}</dt><dd className="font-semibold text-ink">{p.deductible ? money(p.deductible) : '—'}</dd></div>
            <div><dt className="text-xs text-muted">{t('cards.summary.waiting')}</dt><dd className="font-semibold text-ink">{p.waitingDays ? t('cards.summary.days', { n: p.waitingDays }) : t('home.none')}</dd></div>
            <div><dt className="text-xs text-muted">{t('home.premium')}</dt><dd className="font-semibold text-ink"><span className="whitespace-nowrap">{p.monthlyPremium ? `${money(p.monthlyPremium)}${t('cards.compare.perMonth')}` : t('home.singleTrip')}</span></dd></div>
          </dl>
          <div className="mt-auto flex flex-wrap gap-1.5">
            {p.status === 'upcoming' ? <Badge tone="info" icon="clock">{t('home.startsIn', { n: start })}</Badge> : <Badge tone="ok">{t('home.active')}</Badge>}
            {p.status === 'active' && days <= 60 && <Badge tone="warn" icon="clock">{t('home.renewsIn', { n: days })}</Badge>}
            {p.gap && <Badge tone="danger" icon="info">{t('home.gapDetected')}</Badge>}
          </div>
        </div>
        <div className="card absolute inset-0 flex flex-col [backface-visibility:hidden] [transform:rotateY(180deg)]" aria-hidden={!flipped}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t('home.keyClauses')}</p>
          <ul className="mt-2 space-y-2 overflow-hidden text-[13px]">
            {key.map((c) => <li key={c.id}><strong className="text-brand">{c.id}</strong> <span className="text-ink">{tx(c.title)}</span></li>)}
          </ul>
          <Link to={`/policies/${p.id}`} tabIndex={flipped ? 0 : -1} className="btn-primary btn-compact mt-auto">{t('home.openPolicy')}</Link>
        </div>
      </motion.div>
      <button type="button" onClick={() => setFlipped(!flipped)} className="mx-auto mt-1 flex min-h-touch items-center text-[13px] font-medium text-primary" aria-pressed={flipped}>{flipped ? t('home.flipBack') : t('home.flip')}</button>
    </div>
  );
}
