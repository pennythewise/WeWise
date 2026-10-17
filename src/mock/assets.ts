import { L } from '@/engine/l';

export type AssetKind = 'car' | 'house' | 'scooter';
export interface Asset { id: string; kind: AssetKind; name: L; subtitle: L; policyId?: string; facts: { label: L; value: L }[] }

/** Physical assets for the 3D showcase. Generic models: no real vehicle brand or logo is depicted. */
export const ASSETS: Asset[] = [
  { id: 'asset_car', kind: 'car', name: L('Electric sedan', '纯电轿车'), subtitle: L('Registered 2026 · Shenzhen', '2026 年上牌 · 深圳'), policyId: 'pol_mei_motor_01',
    facts: [{ label: L('Range', '续航'), value: L('700 km', '700 公里') }, { label: L('Value', '车价'), value: L('¥259,900', '¥259,900') }] },
  { id: 'asset_house', kind: 'house', name: L('Family home', '自住房产'), subtitle: L('Nanshan, Shenzhen · 2 storeys', '深圳南山 · 两层'), policyId: 'pol_mei_home_01',
    facts: [{ label: L('Floor area', '建筑面积'), value: L('186 m²', '186 平方米') }, { label: L('Built', '建成'), value: L('2021', '2021 年') }] },
  { id: 'asset_scooter', kind: 'scooter', name: L('Electric scooter', '电动滑板车'), subtitle: L('Daily commute', '日常通勤'),
    facts: [{ label: L('Range', '续航'), value: L('45 km', '45 公里') }, { label: L('Value', '价值'), value: L('¥4,200', '¥4,200') }] },
];
