import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/components/AppIcon';
import { Badge, Notice } from '@/components/ui';
import type { ClaimDoc } from '@/mock/claims';
import { useTx } from '@/i18n/useTx';
import { useClaimStore } from './claimStore';
import { claimActions } from './claimActions';

const STATE_BADGE = {
  recognised: { tone: 'ok', icon: 'check', key: 'recognised' },
  confirmed: { tone: 'ok', icon: 'check', key: 'confirmed' },
  toAdd: { tone: 'warn', icon: 'info', key: 'toAdd' },
  optional: { tone: 'neutral', icon: 'clock', key: 'optional' },
} as const;

/** Document row (PRD §5.2 DocRow + ExtractedFieldsPanel). Draft only: editing is locked once submitted. */
export function DocRow({ doc, locked = false, compact = false }: { doc: ClaimDoc; locked?: boolean; compact?: boolean }) {
  const { t } = useTranslation();
  const { tx } = useTx();
  const { confirmDoc, correctField } = useClaimStore();
  const [open, setOpen] = useState(doc.state === 'recognised' && !!doc.warning);
  const prev = useRef(doc.state);
  // A freshly added document opens so its fields (and any inconsistency warning) are seen straight away.
  useEffect(() => { if (prev.current === 'toAdd' && doc.state === 'recognised') setOpen(true); prev.current = doc.state; }, [doc.state]);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const b = STATE_BADGE[doc.state];
  const expandable = doc.fields.length > 0;

  return (
    <li className="border-b border-[#E2E9F4] last:border-0" data-doc={doc.id}>
      <div className="flex items-center gap-3 px-3 py-3.5">
        <span className="text-brand"><AppIcon name="file" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-ink">{tx(doc.name)}</p>
          <p className="text-xs text-muted">{doc.required ? t('claims.required') : t('claims.optional')}</p>
          <Badge className="mt-1.5" tone={doc.warning ? 'warn' : b.tone} icon={doc.warning ? 'info' : b.icon}>{doc.warning ? t('claims.doc.check') : t(`claims.doc.${b.key}`)}</Badge>
        </div>
        {expandable && !compact && (
          <button type="button" className="icon-btn -mr-2" aria-expanded={open} aria-label={`${tx(doc.name)}: ${t('claims.doc.toggle')}`} onClick={() => setOpen(!open)}>
            <AppIcon name="chevron" size={18} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
          </button>
        )}
      </div>
      {doc.state === 'toAdd' && !locked && (
        <div className="px-3 pb-3.5"><button type="button" className="btn-secondary btn-compact" onClick={() => void claimActions.upload(doc.id)}>{t('claims.doc.useDemo')}</button></div>
      )}
      {open && expandable && !compact && (
        <div className="space-y-2 px-3 pb-3.5">
          {doc.warning && <Notice tone="warn">{tx(doc.warning)}</Notice>}
          <dl className="rounded-input border border-cardline bg-surface">
            {doc.fields.map((f) => (
              <div key={f.key} className="flex items-center justify-between gap-2 border-b border-cardline px-3 py-2 last:border-0">
                <dt className="text-xs text-muted">{tx(f.label)}</dt>
                <dd className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                  {editKey === f.key ? (
                    <>
                      <input autoFocus aria-label={tx(f.label)} value={draft} onChange={(e) => setDraft(e.target.value)} className="min-h-[44px] w-32 rounded-input border border-line px-2" />
                      <button type="button" className="btn-primary btn-compact" onClick={() => { correctField(doc.id, f.key, draft); setEditKey(null); }}>{t('cards.extract.save')}</button>
                    </>
                  ) : (
                    <>
                      {f.value}
                      {!locked && doc.state !== 'optional' && <button type="button" className="min-h-[36px] px-1 text-xs font-semibold text-primary" onClick={() => { setDraft(f.value); setEditKey(f.key); }}>{t('cards.extract.correct')}</button>}
                    </>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          {!locked && doc.state === 'recognised' && (
            <button type="button" className="btn-primary btn-compact" disabled={!!doc.warning} onClick={() => confirmDoc(doc.id)}>{t('claims.doc.confirm')}</button>
          )}
          {doc.warning && <p className="text-xs text-muted">{t('claims.doc.fixFirst')}</p>}
        </div>
      )}
    </li>
  );
}
