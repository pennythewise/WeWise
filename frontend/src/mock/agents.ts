import { L } from '@/engine/l';

export interface HumanAgent { id: string; name: string; langs: ('en' | 'zh')[]; city: L; rating: number; replyMins: number; load: number; license: string }
export const AGENTS: HumanAgent[] = [
  { id: 'ag_chen', name: 'Daniel Chen', langs: ['en', 'zh'], city: L('Shenzhen', '深圳'), rating: 4.8, replyMins: 15, load: 3, license: 'Licensed Agent · FA-1042' },
  { id: 'ag_wang', name: 'Wang Xiaoyu', langs: ['zh', 'en'], city: L('Guangzhou', '广州'), rating: 4.7, replyMins: 25, load: 5, license: 'Licensed Agent · FA-0877' },
  { id: 'ag_lim', name: 'Grace Lim', langs: ['en', 'zh'], city: L('Shenzhen', '深圳'), rating: 4.9, replyMins: 40, load: 8, license: 'Licensed Agent · FA-1310' },
  { id: 'ag_wong', name: 'Kenneth Wong', langs: ['zh', 'en'], city: L('Hangzhou', '杭州'), rating: 4.6, replyMins: 20, load: 4, license: 'Licensed Agent · FA-0951' },
  { id: 'ag_zhao', name: 'Zhao Min', langs: ['en'], city: L('Dongguan', '东莞'), rating: 4.5, replyMins: 30, load: 2, license: 'Licensed Agent · FA-1188' },
  { id: 'ag_liu', name: 'Liu Jun', langs: ['en', 'zh'], city: L('Hong Kong', '香港'), rating: 4.8, replyMins: 35, load: 6, license: 'Licensed Agent · FA-0420' },
];
export const agentById = (id: string) => AGENTS.find((a) => a.id === id)!;
