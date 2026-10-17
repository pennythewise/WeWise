import { L } from '@/engine/l';

// Fictional brands (PRD §8 safest fallback): no real insurer names or logos.
export interface Insurer { id: string; name: string; zh: string; color: string }
export const INSURERS: Insurer[] = [
  { id: 'harbour', name: 'Harbour Mutual', zh: '海港互助', color: '#1A4F99' },
  { id: 'orchid', name: 'Orchid Assurance', zh: '兰花保险', color: '#3A5ECF' },
  { id: 'pinnacle', name: 'Pinnacle Life', zh: '峰顶人寿', color: '#167C59' },
  { id: 'sunrise', name: 'Sunrise General', zh: '朝阳综合', color: '#9B5A10' },
  { id: 'banyan', name: 'Banyan Care', zh: '榕树关怀', color: '#61718C' },
];
export const insurerById = (id: string) => INSURERS.find((i) => i.id === id)!;
export const INSURER_DISCLAIMER = L('Fictional insurers for demonstration. Not affiliated with or endorsed by any real insurer.', '演示用虚构保险公司，与任何真实保险公司无关，亦未获其认可。');
