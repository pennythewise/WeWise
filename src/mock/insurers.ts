import { L } from '@/engine/l';

// Real Chinese insurers used as illustrative labels (PRD §8). No logos: a coloured monogram stands in.
// Product names are real product lines where marked; prices and policy wording in this demo are simplified examples.
export interface Insurer { id: string; name: string; zh: string; color: string; mark: string; hotline: string }
export const INSURERS: Insurer[] = [
  { id: 'harbour', name: 'Ping An', zh: '中国平安', color: '#E8590C', mark: '平', hotline: '95511' },
  { id: 'orchid', name: 'ZhongAn Insurance', zh: '众安保险', color: '#0F8B7E', mark: '众', hotline: '1010-9955' },
  { id: 'pinnacle', name: 'China Life', zh: '中国人寿', color: '#16704A', mark: '寿', hotline: '95519' },
  { id: 'sunrise', name: 'CPIC', zh: '中国太保', color: '#1E5BB8', mark: '太', hotline: '95500' },
  { id: 'banyan', name: 'PICC', zh: '中国人保', color: '#C8102E', mark: '人', hotline: '95518' },
];
export const insurerById = (id: string) => INSURERS.find((i) => i.id === id)!;
export const INSURER_DISCLAIMER = L(
  'Real insurer and product names are used as illustrative labels only. Prices, limits and policy wording are simplified examples, not the insurers\' actual terms. Not affiliated with or endorsed by any insurer.',
  '真实保险公司及产品名称仅作示意。价格、限额及条款均为简化示例，并非保险公司的实际条款。本演示与任何保险公司无关联，亦未获其认可。',
);
