import { useTranslation } from 'react-i18next';
import { StageControls } from '@/features/stage/StageControls';
import { LanguageSwitch } from '@/features/settings/LanguageSwitch';
import { AppIcon } from '@/components/AppIcon';
import { useUiStore } from '@/store';
import type { LayoutMode } from './useBreakpoint';

/** Stage bar above the app column (showcase/tablet). `?record=1` hides everything except the tablet inspector chip. */
export function TopBar({ mode }: { mode: LayoutMode }) {
  const { t } = useTranslation();
  const { record, setInspectorOpen } = useUiStore();
  const tablet = mode === 'tablet';
  if (record && !tablet) return null;
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-cardline bg-white px-4 py-2">
      {!record && <StageControls className="min-w-0 flex-1" hidePicker={mode === 'showcase'} />}
      <div className="ml-auto flex items-center gap-2">
        {!record && <LanguageSwitch />}
        {tablet && (
          <button type="button" className="btn-primary btn-compact" onClick={() => setInspectorOpen(true)}>
            <AppIcon name="info" size={16} />
            {t('header.inspector')}
          </button>
        )}
      </div>
    </div>
  );
}
