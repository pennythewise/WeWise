import { L } from '@/engine/l';

export type InsuranceType = 'medical' | 'critical' | 'accident' | 'life' | 'travel' | 'motor' | 'home';

export interface Product {
  id: string;
  insurerId: string;
  name: L;
  type: InsuranceType;
  monthlyPremium: number;
  deductible: number;
  coPayPct: number;
  annualLimit: number;
  roomCap: number; // per day, 0 = n/a
  waitingDays: number;
  /** 1 (low) .. 5 (high) */
  hikeRisk: number;
  claimFriction: number;
  premiumTrajectory: L;
}

export const PRODUCTS: Product[] = [
  { id: 'prod_hs_a', insurerId: 'banyan', name: L('Banyan Care Lite', '榕树轻享医疗'), type: 'medical', monthlyPremium: 228, deductible: 10000, coPayPct: 30, annualLimit: 1000000, roomCap: 300, waitingDays: 120, hikeRisk: 4, claimFriction: 3, premiumTrajectory: L('Low now, steep step-ups after age 35', '起步低，35 岁后涨幅较陡') },
  { id: 'prod_hs_b', insurerId: 'orchid', name: L('Orchid MediPlus', '兰花医保加强版'), type: 'medical', monthlyPremium: 296, deductible: 5000, coPayPct: 10, annualLimit: 3000000, roomCap: 600, waitingDays: 90, hikeRisk: 2, claimFriction: 2, premiumTrajectory: L('Smoother, capped yearly adjustment', '涨幅平缓，年度调整有上限') },
  { id: 'prod_hs_c', insurerId: 'harbour', name: L('Harbour Hospital & Surgical Plan', '海港住院手术计划'), type: 'medical', monthlyPremium: 268, deductible: 10000, coPayPct: 20, annualLimit: 2000000, roomCap: 500, waitingDays: 90, hikeRisk: 3, claimFriction: 2, premiumTrajectory: L('Moderate yearly increases', '每年温和上涨') },
  { id: 'prod_hs_d', insurerId: 'sunrise', name: L('Sunrise Family Shield', '朝阳家庭盾'), type: 'medical', monthlyPremium: 342, deductible: 5000, coPayPct: 10, annualLimit: 4000000, roomCap: 800, waitingDays: 60, hikeRisk: 3, claimFriction: 2, premiumTrajectory: L('Higher start, includes child cover', '起步较高，含儿童保障') },
  { id: 'prod_ci_a', insurerId: 'pinnacle', name: L('Pinnacle CI Guard 45', '峰顶重疾守护 45'), type: 'critical', monthlyPremium: 189, deductible: 0, coPayPct: 0, annualLimit: 300000, roomCap: 0, waitingDays: 90, hikeRisk: 1, claimFriction: 3, premiumTrajectory: L('Level premium to age 65', '保费至 65 岁保持不变') },
  { id: 'prod_ci_b', insurerId: 'orchid', name: L('Orchid Critical Care', '兰花重疾关怀'), type: 'critical', monthlyPremium: 210, deductible: 0, coPayPct: 0, annualLimit: 400000, roomCap: 0, waitingDays: 90, hikeRisk: 1, claimFriction: 2, premiumTrajectory: L('Level premium', '保费保持不变') },
  { id: 'prod_pa_a', insurerId: 'pinnacle', name: L('Pinnacle Personal Accident', '峰顶个人意外险'), type: 'accident', monthlyPremium: 45, deductible: 0, coPayPct: 0, annualLimit: 300000, roomCap: 0, waitingDays: 0, hikeRisk: 1, claimFriction: 1, premiumTrajectory: L('Flat', '保持不变') },
  { id: 'prod_pa_b', insurerId: 'banyan', name: L('Banyan Everyday Accident', '榕树日常意外险'), type: 'accident', monthlyPremium: 38, deductible: 0, coPayPct: 0, annualLimit: 200000, roomCap: 0, waitingDays: 0, hikeRisk: 1, claimFriction: 2, premiumTrajectory: L('Flat', '保持不变') },
  { id: 'prod_tr_a', insurerId: 'sunrise', name: L('Sunrise Travel Flex', '朝阳灵活旅行险'), type: 'travel', monthlyPremium: 0, deductible: 0, coPayPct: 0, annualLimit: 500000, roomCap: 0, waitingDays: 0, hikeRisk: 1, claimFriction: 2, premiumTrajectory: L('Single-trip price', '单次旅程定价') },
  { id: 'prod_life_a', insurerId: 'pinnacle', name: L('Pinnacle Term Life 20', '峰顶 20 年定期寿险'), type: 'life', monthlyPremium: 96, deductible: 0, coPayPct: 0, annualLimit: 500000, roomCap: 0, waitingDays: 30, hikeRisk: 1, claimFriction: 2, premiumTrajectory: L('Level for 20 years', '20 年保费不变') },
];
export const productById = (id: string) => PRODUCTS.find((p) => p.id === id)!;

export interface CostEstimate { youPay: number; insurerPays: number; capped: boolean }
/** Pure TS port of the backend `cost_estimator` (PRD B2): the worked example is computed by code, never by the LLM. */
export function estimateCost(p: Pick<Product, 'deductible' | 'coPayPct' | 'annualLimit'>, bill: number): CostEstimate {
  const afterDeductible = Math.max(0, bill - p.deductible);
  const insurerRaw = afterDeductible * (1 - p.coPayPct / 100);
  const insurerPays = Math.min(insurerRaw, p.annualLimit);
  return { youPay: Math.round(bill - insurerPays), insurerPays: Math.round(insurerPays), capped: insurerRaw > p.annualLimit };
}
