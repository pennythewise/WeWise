import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { L } from '@/engine/l';
import { AppIcon } from '@/components/AppIcon';
import { useTx } from '@/i18n/useTx';
import { useAgentStore } from '@/agentStore';
import { cityById } from '@/mock/cities';
import { useLocationStore } from './locationStore';
import { LocationPermission } from './LocationPermission';

/** Home: ask for location the first time the app opens; afterwards a one-line entry to location-based suggestions. */
export function HomeLocation() {
  const { tx } = useTx();
  const navigate = useNavigate();
  const { status, cityId, decline } = useLocationStore();
  const [open, setOpen] = useState(false);
  const suggest = (id: string) => {
    navigate('/ask');
    void useAgentStore.getState().runTurn('location.suggest', id, L('Suggest insurance for where I am', '根据我所在的地方推荐保险'));
  };

  if (status === 'unknown' || status === 'asking') {
    // Slim banner first; the full consent explainer opens on tap, before any system prompt.
    if (open || status === 'asking') return <LocationPermission onDone={(id) => { if (id) suggest(id); }} />;
    return (
      <div className="flex items-center gap-3 rounded-card border border-secline bg-bluewash/60 p-3" data-testid="location-banner">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-brand ring-1 ring-secline"><AppIcon name="home" size={20} /></span>
        <p className="min-w-0 flex-1 text-[13px] leading-snug"><span className="block font-semibold text-ink">{tx(L('Cover that fits where you live', '适合您所在地的保障'))}</span><span className="text-muted">{tx(L('Share your city, nothing else.', '只分享城市，不含其他信息。'))}</span></p>
        <button type="button" className="btn-primary btn-compact shrink-0" onClick={() => setOpen(true)}>{tx(L('Set up', '设置'))}</button>
        <button type="button" className="icon-btn shrink-0 text-muted" aria-label={tx(L('Not now', '暂不'))} onClick={decline}><span aria-hidden="true" className="text-[18px] leading-none">×</span></button>
      </div>
    );
  }
  if ((status === 'granted' || status === 'demo') && cityId) {
    return (
      <button type="button" onClick={() => suggest(cityId)} className="flex min-h-touch w-full items-center gap-3 rounded-card border border-cardline bg-white p-3 text-left" data-testid="home-location">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bluewash text-brand"><AppIcon name="home" size={20} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold text-ink">{tx(L(`Cover for ${cityById(cityId).name.en}`, `适合${cityById(cityId).name.zh}的保障`))}</span>
          <span className="block text-xs text-muted">{tx(L('AI suggestions based on local risks and what you already have', '根据当地风险和现有保障的 AI 建议'))}</span>
        </span>
        <AppIcon name="chevron" size={16} />
      </button>
    );
  }
  return null; // declined: don't nag; the agent can still ask in chat
}
