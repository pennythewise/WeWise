import { useState } from 'react';
import { L } from '@/engine/l';
import { AppIcon } from '@/components/AppIcon';
import { Badge, CardShell, Notice } from '@/components/ui';
import { RichText } from '../chat/CitationChip';
import { useTx } from '@/i18n/useTx';
import { useAgentStore } from '@/agentStore';
import { cityById, RISK_LABEL, suggestionsFor } from '@/mock/cities';
import { LocationPermission } from './LocationPermission';

/** Chat card: the agent asks for location before suggesting anything. */
export function LocationPermissionCard() {
  const { tx } = useTx();
  const [done, setDone] = useState<'used' | 'declined' | null>(null);
  const finish = (cityId: string | null) => {
    useAgentStore.setState((s) => ({ actionStates: { ...s.actionStates, act_location: cityId ? 'confirmed' : 'rejected' } }));
    if (!cityId) { setDone('declined'); return; }
    setDone('used');
    void useAgentStore.getState().runTurn('location.suggest', cityId);
  };
  return (
    <CardShell title={tx(L('Location permission', '位置权限'))} icon="lock">
      {done === 'used' ? <p className="flex items-center gap-2 text-[13px] text-ok"><AppIcon name="check" size={16} />{tx(L('Thanks. Looking at risks where you are…', '谢谢，正在分析您所在地的风险…'))}</p>
        : done === 'declined' ? <p className="text-[13px] text-body">{tx(L('No problem. I won\'t use your location. You can still tell me your city in a message.', '没问题，我不会使用您的位置。您也可以直接告诉我所在城市。'))}</p>
        : <LocationPermission onDone={finish} compact />}
    </CardShell>
  );
}

const PRIORITY = { high: { tone: 'danger', label: L('Act soon', '尽快处理') }, medium: { tone: 'warn', label: L('Worth a look', '值得考虑') }, low: { tone: 'ok', label: L('Already OK', '已基本覆盖') } } as const;

/** Chat card: location-based suggestions, each tied to the user's existing cover and a clause. */
export function LocationSuggestCard({ cityId, messageId }: { cityId: string; messageId?: string }) {
  const { tx } = useTx();
  const city = cityById(cityId);
  const list = suggestionsFor(city);
  const [open, setOpen] = useState<string | null>(list[0]?.id ?? null);
  const running = useAgentStore((s) => s.running);
  const ask = (text: string) => void useAgentStore.getState().send(text);

  return (
    <CardShell title={tx(L(`Cover for where you are: ${city.name.en}`, `适合您所在地的保障：${city.name.zh}`))} icon="home">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{tx(L('Local risks', '当地风险'))}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">{city.risks.map((r) => <span key={r} className="rounded-full bg-wash px-2.5 py-1 text-xs text-ink">{tx(RISK_LABEL[r])}</span>)}</div>
      <ul className="mt-3 space-y-2" data-testid="location-suggestions">
        {list.map((s) => (
          <li key={s.id} className="rounded-input border border-cardline">
            <button type="button" aria-expanded={open === s.id} onClick={() => setOpen(open === s.id ? null : s.id)} className="flex min-h-touch w-full items-center gap-3 px-3 py-2.5 text-left">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bluewash text-brand"><AppIcon name={s.icon} size={16} /></span>
              <span className="min-w-0 flex-1 text-[14px] font-semibold text-ink">{tx(s.title)}</span>
              <Badge tone={PRIORITY[s.priority].tone} icon={false}>{tx(PRIORITY[s.priority].label)}</Badge>
            </button>
            {open === s.id && (
              <div className="animate-fade-in space-y-1.5 px-3 pb-3 text-[13px] leading-relaxed text-body">
                <p><strong className="text-ink">{tx(L('Why here: ', '原因：'))}</strong>{tx(s.why)}</p>
                <p><strong className="text-ink">{tx(L('What you have: ', '现有保障：'))}</strong><RichText text={tx(s.have)} messageId={messageId} /></p>
                <p><strong className="text-ink">{tx(L('Next step: ', '下一步：'))}</strong>{tx(s.next)}</p>
                <button type="button" className="btn-secondary btn-compact mt-1" disabled={running} onClick={() => ask(tx(s.ask))}>{tx(L('Ask about this', '就此提问'))}</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-3"><Notice tone="info">{tx(L('Suggestions are ranked by risk and what you already have, not by price. The cheapest option is not always the best. WeWise doesn\'t sell insurance; a licensed agent can quote.', '建议按风险和现有保障排序，而非价格；最便宜的不一定最好。微晓不销售保险，可由持牌顾问报价。'))}</Notice></div>
      <button type="button" className="btn-primary mt-3 w-full" disabled={running} onClick={() => ask(tx(L('Talk to a licensed agent', '联系持牌顾问')))}>{tx(L('Get quotes from a licensed agent', '请持牌顾问报价'))}</button>
    </CardShell>
  );
}
