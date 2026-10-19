import type { NavigateFunction } from 'react-router-dom';
import { L } from '@/engine/l';
import { useAgentStore } from '@/agentStore';
import { shopProductById } from '@/mock/shop';
import { useShopStore } from './shopStore';

/** Hands the selected marketplace products to 问微晓, which asks what the user wants to compare. */
export function startAiCompare(navigate: NavigateFunction) {
  const ids = useShopStore.getState().compare;
  const ps = ids.map(shopProductById).filter((p) => !!p);
  if (ps.length < 2) return;
  const userText = L(`Help me compare: ${ps.map((p) => p!.name.en).join(' vs ')}`, `帮我对比：${ps.map((p) => p!.name.zh).join('、')}`);
  navigate('/ask');
  void useAgentStore.getState().runTurn('shop.compare.ask', ids.join(','), userText);
  useShopStore.getState().setCompareMode(false);
}
