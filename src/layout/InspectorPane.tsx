import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InspectorContent } from '@/features/inspector/InspectorContent';
import { Sheet } from '@/components/Sheet';
import { useUiStore } from '@/store';

/** Showcase: always-open right column. */
export function InspectorPane() {
  const { t } = useTranslation();
  return (
    <aside aria-label={t('inspector.title')} className="flex h-full w-[var(--inspector-width)] shrink-0 flex-col border-l border-cardline bg-white">
      <h2 className="flex min-h-[56px] shrink-0 items-center border-b border-cardline px-4 text-[17px] font-semibold text-ink">{t('inspector.title')}</h2>
      <div className="min-h-0 flex-1"><InspectorContent /></div>
    </aside>
  );
}

/** Tablet: right drawer opened by the "How I got this" chip. */
export function InspectorDrawer() {
  const { t } = useTranslation();
  const { inspectorOpen, setInspectorOpen } = useUiStore();
  return (
    <Sheet open={inspectorOpen} onOpenChange={setInspectorOpen} side="right" title={t('inspector.title')}>
      <InspectorContent />
    </Sheet>
  );
}

const SNAPS = ['30dvh', '60dvh', '92dvh'] as const; // peek · half · full (PRD §7)

/** Phone: bottom sheet with three snap heights, cycled by the handle. */
export function InspectorSheet() {
  const { t } = useTranslation();
  const { inspectorOpen, setInspectorOpen } = useUiStore();
  const [snap, setSnap] = useState(1);
  return (
    <Sheet
      open={inspectorOpen}
      onOpenChange={setInspectorOpen}
      side="bottom"
      title={t('inspector.title')}
      height={SNAPS[snap]}
      top={
        <button
          type="button"
          aria-label={`${t('inspector.title')}: ${SNAPS[snap]}`}
          onClick={() => setSnap((snap + 1) % SNAPS.length)}
          className="flex h-6 w-full shrink-0 items-center justify-center"
        >
          <span className="h-1 w-10 rounded-full bg-line" />
        </button>
      }
    >
      <InspectorContent />
    </Sheet>
  );
}
