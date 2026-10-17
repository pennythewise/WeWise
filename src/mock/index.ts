import { DEMO_TODAY, daysBetween } from '@/engine/l';
import type { Portfolio } from '@/engine/types';
import { POLICIES } from './policies';

export const portfolio = (): Portfolio => {
  const active = POLICIES;
  const renewing = [...POLICIES].filter((p) => p.type !== 'travel').sort((a, b) => a.renewal.localeCompare(b.renewal))[0];
  return {
    userId: 'usr_mei',
    policyIds: active.map((p) => p.id),
    totalCover: POLICIES.reduce((s, p) => s + p.coverAmount, 0),
    monthlyPremium: POLICIES.reduce((s, p) => s + p.monthlyPremium, 0),
    nextRenewal: { policyId: renewing.id, date: renewing.renewal },
  };
};
export const daysUntil = (date: string) => daysBetween(DEMO_TODAY, date);
