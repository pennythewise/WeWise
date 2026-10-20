import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/components/AppIcon';
import { useUiStore } from '@/store';
import type { LayoutMode } from './useBreakpoint';

/** Bar above the app column: on tablet, a button that opens the Agent Inspector. Showcase shows the Inspector beside the phone instead. */
export function TopBar({ mode }: { mode: LayoutMode }) {
  const { t } = useTranslation();
  const { setInspectorOpen } = useUiStore();
  if (mode !== 'tablet') return null;
  return (
    <div className="flex shrink-0 items-center justify-end border-b border-cardline bg-white px-4 py-2">
      <button type="button" className="btn-primary btn-compact" onClick={() => setInspectorOpen(true)}>
        <AppIcon name="info" size={16} />
        {t('header.inspector')}
      </button>
    </div>
  );
}
