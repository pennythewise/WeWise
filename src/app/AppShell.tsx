import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { setNavigate } from '@/navRef';
import { UploadSheet } from '@/features/settings/UploadSheet';
import { AssetShowcase } from '@/features/showcase/AssetShowcase';
import { EmergencyCall } from '@/features/settings/EmergencyCall';
import { useStageShortcuts } from '@/features/stage/useStageShortcuts';
import { playScenario } from '@/features/stage/autoplay';
import { queryFlags } from '@/lib';
import { InspectorDrawer, InspectorPane, InspectorSheet } from '@/layout/InspectorPane';
import { PhoneFrame } from '@/layout/PhoneFrame';
import { TopBar } from '@/layout/TopBar';
import { useBreakpoint } from '@/layout/useBreakpoint';
import { WebsiteNav } from '@/layout/WebsiteNav';
import { Sheet } from '@/components/Sheet';
import { StageControls } from '@/features/stage/StageControls';
import { LanguageSwitch } from '@/features/settings/LanguageSwitch';
import { useUiStore } from '@/store';

export function AppShell() {
  const mode = useBreakpoint();
  const { t } = useTranslation();
  const { navSheetOpen, setNavSheetOpen, record } = useUiStore();
  const navigate = useNavigate();
  useEffect(() => { setNavigate(navigate); }, [navigate]);
  useStageShortcuts(mode === 'showcase');
  useEffect(() => { if (new URLSearchParams(location.search).get('autoplay') === '1') void playScenario(queryFlags.scenario() ?? 1); }, []);
  const overlays = (<><UploadSheet /><EmergencyCall /><AssetShowcase /></>);

  if (mode === 'phone') {
    return (
      <div className="flex h-dvh justify-center bg-wash" data-layout="phone">
        <PhoneFrame mode={mode} />
        <Sheet open={navSheetOpen} onOpenChange={setNavSheetOpen} side="left" title={t('brand.name')}>
          <WebsiteNav variant="sheet" onNavigate={() => setNavSheetOpen(false)} />
          <div className="space-y-4 border-t border-cardline p-4">
            <p className="text-[13px] leading-relaxed text-muted">
              <span className="block font-semibold text-brand">{t('brand.taglineZh')}</span>
              {t('brand.tagline')}
            </p>
            {!record && <LanguageSwitch />}
            {!record && <StageControls />}
          </div>
        </Sheet>
        <InspectorSheet />
        {overlays}
      </div>
    );
  }

  const showcase = mode === 'showcase';
  return (
    <div className="flex h-dvh bg-wash" data-layout={mode}>
      <div className={`shrink-0 border-r border-cardline ${showcase ? 'w-[var(--nav-width)]' : 'w-[var(--rail-width)]'}`}>
        <WebsiteNav variant={showcase ? 'full' : 'rail'} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar mode={mode} />
        <div className="flex min-h-0 flex-1 justify-center p-4">
          <div className="flex h-full max-h-[920px] w-full justify-center"><PhoneFrame mode={mode} /></div>
        </div>
      </div>
      {showcase ? <InspectorPane /> : <InspectorDrawer />}
      {overlays}
    </div>
  );
}
