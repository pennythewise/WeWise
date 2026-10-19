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
  { id: 'prod_hs_a', insurerId: 'banyan', name: L('PICC Haoyibao Long-term Medical', '人保健康好医保·长期医疗'), type: 'medical', monthlyPremium: 228, deductible: 10000, coPayPct: 30, annualLimit: 1000000, roomCap: 300, waitingDays: 120, hikeRisk: 4, claimFriction: 3, premiumTrajectory: L('Lower now; price rises by age band (example)', '起步较低，按年龄段调价（示例）') },
  { id: 'prod_hs_b', insurerId: 'orchid', name: L('ZhongAn Zunxiang e-Sheng', '众安尊享e生'), type: 'medical', monthlyPremium: 296, deductible: 5000, coPayPct: 10, annualLimit: 3000000, roomCap: 600, waitingDays: 90, hikeRisk: 2, claimFriction: 2, premiumTrajectory: L('Smoother, capped yearly adjustment', '涨幅平缓，年度调整有上限') },
  { id: 'prod_hs_c', insurerId: 'harbour', name: L('Ping An e-Sheng Bao Medical', '平安e生保·百万医疗'), type: 'medical', monthlyPremium: 268, deductible: 10000, coPayPct: 20, annualLimit: 2000000, roomCap: 500, waitingDays: 90, hikeRisk: 3, claimFriction: 2, premiumTrajectory: L('Moderate yearly increases', '每年温和上涨') },
  { id: 'prod_hs_d', insurerId: 'sunrise', name: L('CPIC Family Medical (example)', '太保家庭医疗（示例）'), type: 'medical', monthlyPremium: 342, deductible: 5000, coPayPct: 10, annualLimit: 4000000, roomCap: 800, waitingDays: 60, hikeRisk: 3, claimFriction: 2, premiumTrajectory: L('Higher start, includes child cover', '起步较高，含儿童保障') },
  { id: 'prod_ci_a', insurerId: 'pinnacle', name: L('China Life Guoshoufu CI', '国寿福重大疾病保险'), type: 'critical', monthlyPremium: 189, deductible: 0, coPayPct: 0, annualLimit: 300000, roomCap: 0, waitingDays: 90, hikeRisk: 1, claimFriction: 3, premiumTrajectory: L('Level premium to age 65', '保费至 65 岁保持不变') },
  { id: 'prod_ci_b', insurerId: 'orchid', name: L('ZhongAn Critical Illness (example)', '众安重疾险（示例）'), type: 'critical', monthlyPremium: 210, deductible: 0, coPayPct: 0, annualLimit: 400000, roomCap: 0, waitingDays: 90, hikeRisk: 1, claimFriction: 2, premiumTrajectory: L('Level premium', '保费保持不变') },
  { id: 'prod_pa_a', insurerId: 'pinnacle', name: L('China Life Personal Accident', '国寿意外伤害保险'), type: 'accident', monthlyPremium: 45, deductible: 0, coPayPct: 0, annualLimit: 300000, roomCap: 0, waitingDays: 0, hikeRisk: 1, claimFriction: 1, premiumTrajectory: L('Flat', '保持不变') },
  { id: 'prod_pa_b', insurerId: 'banyan', name: L('PICC Everyday Accident (example)', '人保日常意外险（示例）'), type: 'accident', monthlyPremium: 38, deductible: 0, coPayPct: 0, annualLimit: 200000, roomCap: 0, waitingDays: 0, hikeRisk: 1, claimFriction: 2, premiumTrajectory: L('Flat', '保持不变') },
  { id: 'prod_tr_a', insurerId: 'sunrise', name: L('CPIC Overseas Travel', '太保境外旅行险'), type: 'travel', monthlyPremium: 0, deductible: 0, coPayPct: 0, annualLimit: 500000, roomCap: 0, waitingDays: 0, hikeRisk: 1, claimFriction: 2, premiumTrajectory: L('Single-trip price', '单次旅程定价') },
  { id: 'prod_life_a', insurerId: 'pinnacle', name: L('China Life Term Life 20', '国寿 20 年定期寿险'), type: 'life', monthlyPremium: 96, deductible: 0, coPayPct: 0, annualLimit: 500000, roomCap: 0, waitingDays: 30, hikeRisk: 1, claimFriction: 2, premiumTrajectory: L('Level for 20 years', '20 年保费不变') },
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
