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
  const { status, cityId } = useLocationStore();
  const suggest = (id: string) => {
    navigate('/ask');
    void useAgentStore.getState().runTurn('location.suggest', id, L('Suggest insurance for where I am', '根据我所在的地方推荐保险'));
  };

  if (status === 'unknown' || status === 'asking') return <LocationPermission onDone={(id) => { if (id) suggest(id); }} />;
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
