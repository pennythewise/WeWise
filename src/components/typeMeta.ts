import type { IconName } from './AppIcon';
import type { InsuranceType } from '@/mock/products';

export const TYPE_ICON: Record<InsuranceType, IconName> = { medical: 'cross', critical: 'heart', accident: 'umbrella', life: 'shield', travel: 'plane', motor: 'car', home: 'home' };
// Categorical chart colours: all from the brand palette, distinguishable without relying on hue alone (labels sit beside the chart).
export const TYPE_COLOR: Record<InsuranceType, string> = { medical: '#3A5ECF', critical: '#9B5A10', accident: '#167C59', life: '#1A4F99', travel: '#61718C', motor: '#1D2943', home: '#8CA3EF' };
