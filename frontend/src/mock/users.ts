import { L } from '@/engine/l';

export const USER = { id: 'usr_mei', name: 'Mei Lin Tan', age: 29, city: L('Shenzhen', '深圳'), maskedName: 'M** L** T**', maskedPhone: '+86 138****5082', maskedId: '9***** -**-***4' };

export interface MemoryFact { id: string; text: L }
export const INITIAL_MEMORY: MemoryFact[] = [
  { id: 'mem_budget', text: L('Budget around ¥300 / month for hospital cover', '医疗保障预算约每月 ¥300') },
  { id: 'mem_lang', text: L('Prefers English, also reads 中文', '偏好英文，也看得懂中文') },
  { id: 'mem_family', text: L('Has a young child (dependant)', '有一个年幼的孩子（受抚养人）') },
  { id: 'mem_trip', text: L('Planning a trip to Thailand in December', '计划十二月前往泰国旅行') },
];
