import { L } from '@/engine/l';

export interface Incident {
  country: string; name: L; flag: string;
  numbers: { label: L; number: string }[];
  steps: L[]; avoid: L[]; policyDeadline?: { clauseId: string; note: L };
}

const STEPS: L[] = [
  L('Move to safety and call local emergency services if anyone is hurt.', '先确保安全，如有人受伤请拨打当地急救电话。'),
  L('Call your insurer\'s 24-hour assistance line (within 48 hours).', '致电保险公司 24 小时救援热线（须在 48 小时内）。'),
  L('Take photos of the scene, vehicles and injuries.', '拍摄现场、车辆及伤情照片。'),
  L('Get a local police report before you leave the country.', '离境前取得当地警方报告。'),
  L('Keep every receipt and medical record.', '保留所有收据及病历。'),
];
const AVOID: L[] = [
  L('Do not admit fault or sign papers you cannot read.', '不要承认过错，也不要签署看不懂的文件。'),
  L('Do not agree to cash settlements before calling your insurer.', '未联系保险公司前不要同意现金和解。'),
];
const DEADLINE = { clauseId: 'TR-7.2', note: L('Report within 48 hours of the incident', '须在事故后 48 小时内报案') };

export const INCIDENTS: Incident[] = [
  { country: 'TH', name: L('Thailand', '泰国'), flag: '🇹🇭', numbers: [{ label: L('Police', '警察'), number: '191' }, { label: L('Ambulance', '救护车'), number: '1669' }, { label: L('Tourist police', '旅游警察'), number: '1155' }], steps: STEPS, avoid: AVOID, policyDeadline: DEADLINE },
  { country: 'SG', name: L('Singapore', '新加坡'), flag: '🇸🇬', numbers: [{ label: L('Police', '警察'), number: '999' }, { label: L('Ambulance', '救护车'), number: '995' }], steps: STEPS, avoid: AVOID, policyDeadline: DEADLINE },
  { country: 'MY', name: L('Malaysia', '马来西亚'), flag: '🇲🇾', numbers: [{ label: L('Emergency', '紧急电话'), number: '999' }, { label: L('Ambulance', '救护车'), number: '994' }], steps: STEPS, avoid: AVOID },
  { country: 'CN', name: L('China', '中国'), flag: '🇨🇳', numbers: [{ label: L('Police', '警察'), number: '110' }, { label: L('Ambulance', '救护车'), number: '120' }], steps: STEPS, avoid: AVOID, policyDeadline: DEADLINE },
  { country: 'JP', name: L('Japan', '日本'), flag: '🇯🇵', numbers: [{ label: L('Police', '警察'), number: '110' }, { label: L('Ambulance / Fire', '救护车 / 消防'), number: '119' }], steps: STEPS, avoid: AVOID, policyDeadline: DEADLINE },
  { country: 'AU', name: L('Australia', '澳大利亚'), flag: '🇦🇺', numbers: [{ label: L('Emergency', '紧急电话'), number: '000' }], steps: STEPS, avoid: AVOID, policyDeadline: DEADLINE },
];
export const incidentFor = (country: string) => INCIDENTS.find((i) => i.country === country) ?? INCIDENTS[0];
