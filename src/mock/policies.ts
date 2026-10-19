import { L } from '@/engine/l';
import type { InsuranceType } from './products';

export interface Policy {
  id: string;
  insurerId: string;
  product: L;
  type: InsuranceType;
  policyNo: string; // masked in UI
  inception: string;
  renewal: string; // or coverage end for single-trip
  status: 'active' | 'upcoming';
  coverAmount: number;
  deductible: number;
  coPayPct: number;
  roomCap: number;
  waitingDays: number;
  monthlyPremium: number;
  premiumHistory: number[];
  keyTerms: { label: L; value: L }[];
  gap?: L;
}

export const POLICIES: Policy[] = [
  {
    id: 'pol_mei_health_01', insurerId: 'harbour', product: L('Hospital & Surgical Plan', '住院手术计划'), type: 'medical', policyNo: 'HM-2025-48****91',
    inception: '2025-11-25', renewal: '2026-11-25', status: 'active', coverAmount: 2000000, deductible: 10000, coPayPct: 20, roomCap: 500, waitingDays: 90, monthlyPremium: 268,
    premiumHistory: [214, 226, 240, 252, 268],
    keyTerms: [
      { label: L('Annual limit', '年度限额'), value: L('¥2,000,000', '¥2,000,000') },
      { label: L('Deductible', '自付额'), value: L('¥10,000 per admission', '每次入院 ¥10,000') },
      { label: L('Co-pay', '共付比例'), value: L('20% above deductible', '超出自付额部分 20%') },
      { label: L('Room cap', '房费上限'), value: L('¥500 / day', '每日 ¥500') },
      { label: L('Waiting period', '等待期'), value: L('90 days (illness)', '90 天（疾病）') },
    ],
    gap: L('No outpatient cover', '不含门诊保障'),
  },
  {
    id: 'pol_mei_pa_01', insurerId: 'pinnacle', product: L('Personal Accident Plan', '个人意外保障计划'), type: 'accident', policyNo: 'PL-2026-10****37',
    inception: '2026-01-18', renewal: '2027-01-18', status: 'active', coverAmount: 300000, deductible: 0, coPayPct: 0, roomCap: 0, waitingDays: 0, monthlyPremium: 45,
    premiumHistory: [45, 45, 45, 45, 45],
    keyTerms: [
      { label: L('Accidental death / disability', '意外身故 / 伤残'), value: L('¥300,000', '¥300,000') },
      { label: L('Medical reimbursement', '医疗费用报销'), value: L('up to ¥10,000', '最高 ¥10,000') },
      { label: L('Waiting period', '等待期'), value: L('None for accidents', '意外无等待期') },
    ],
  },
  {
    id: 'pol_mei_travel_01', insurerId: 'sunrise', product: L('Travel Flex – Thailand', '灵活旅行险 – 泰国'), type: 'travel', policyNo: 'SG-2026-77****05',
    inception: '2026-12-20', renewal: '2027-01-03', status: 'upcoming', coverAmount: 500000, deductible: 0, coPayPct: 0, roomCap: 0, waitingDays: 0, monthlyPremium: 0,
    premiumHistory: [186],
    keyTerms: [
      { label: L('Overseas medical', '海外医疗'), value: L('¥500,000', '¥500,000') },
      { label: L('Trip cancellation', '行程取消'), value: L('¥10,000', '¥10,000') },
      { label: L('Report within', '须在以下时间内报案'), value: L('48 hours of incident', '事故后 48 小时内') },
    ],
    gap: L('Adventure sports excluded', '不含冒险运动'),
  },
  {
    id: 'pol_mei_motor_01', insurerId: 'sunrise', product: L('Comprehensive Motor Plan', '机动车综合险'), type: 'motor', policyNo: 'SG-2026-31****62',
    inception: '2026-03-08', renewal: '2027-03-08', status: 'active', coverAmount: 1000000, deductible: 0, coPayPct: 0, roomCap: 0, waitingDays: 0, monthlyPremium: 425,
    premiumHistory: [398, 410, 425],
    keyTerms: [
      { label: L('Vehicle damage', '车辆损失'), value: L('¥259,900', '¥259,900') },
      { label: L('Third-party liability', '第三者责任'), value: L('¥1,000,000', '¥1,000,000') },
      { label: L('Roadside assistance', '道路救援'), value: L('Included, 3 times a year', '含，每年 3 次') },
    ],
  },
  {
    id: 'pol_mei_home_01', insurerId: 'banyan', product: L('Home Contents & Fire Plan', '家庭财产综合险'), type: 'home', policyNo: 'BC-2026-52****18',
    inception: '2026-05-20', renewal: '2027-05-20', status: 'active', coverAmount: 1500000, deductible: 0, coPayPct: 0, roomCap: 0, waitingDays: 0, monthlyPremium: 62,
    premiumHistory: [58, 60, 62],
    keyTerms: [
      { label: L('Building: fire and water damage', '房屋：火灾与水渍'), value: L('¥1,000,000', '¥1,000,000') },
      { label: L('Contents', '室内财产'), value: L('¥300,000', '¥300,000') },
      { label: L('Household liability', '家庭责任'), value: L('¥200,000', '¥200,000') },
    ],
    gap: L('Flood from outside the building is excluded', '不含楼外洪水'),
  },
  {
    id: 'pol_mei_drone_01', insurerId: 'pinnacle', product: L('Drone Damage & Liability Plan', '无人机机身与第三者责任险'), type: 'accident', policyNo: 'PL-2026-66****19',
    inception: '2026-06-12', renewal: '2027-06-12', status: 'active', coverAmount: 500000, deductible: 200, coPayPct: 0, roomCap: 0, waitingDays: 0, monthlyPremium: 38,
    premiumHistory: [38, 38, 38],
    keyTerms: [
      { label: L('Aircraft damage', '机身损失'), value: L('¥6,988', '¥6,988') },
      { label: L('Third-party liability', '第三者责任'), value: L('¥500,000', '¥500,000') },
      { label: L('Lost-link / fly-away', '失联 / 炸机'), value: L('Included, 1 claim a year', '含，每年 1 次') },
    ],
    gap: L('No cover in no-fly zones or without local flight approval', '禁飞区或未获当地飞行许可时不赔'),
  },
];
export const policyById = (id: string) => POLICIES.find((p) => p.id === id);
