import { L } from '@/engine/l';

export interface Incident {
  country: string; name: L; flag: string;
  numbers: { label: L; number: string }[];
  steps: L[]; avoid: L[]; policyDeadline?: { clauseId: string; note: L };
}

const STEPS: L[] = [
  L('Move to safety and call local emergency services if anyone is hurt.', '先确保安全，如有人受伤请拨打当地急救电话。'),
  L('Contact the assistance provider on your issued policy promptly; check its actual notification and authorization requirements.', '及时联系已签发保单列明的协助机构，核对实际通知期限及事先授权要求。'),
  L('When safe and permitted, record the time, location and relevant evidence. Do not delay treatment to take photos.', '仅在安全且允许时记录时间、地点和相关证据，不要为了拍照延误治疗。'),
  L('Obtain police or third-party incident evidence only when relevant or required by the applicable insurer process.', '仅在涉及警方、第三方或适用理赔流程要求时准备相关事故证明。'),
  L('Keep every receipt and medical record.', '保留所有收据及病历。'),
];
const AVOID: L[] = [
  L('Do not admit fault or sign papers you cannot read.', '不要承认过错，也不要签署看不懂的文件。'),
  L('Do not agree to cash settlements before calling your insurer.', '未联系保险公司前不要同意现金和解。'),
];

export const INCIDENTS: Incident[] = [
  { country: 'TH', name: L('Thailand', '泰国'), flag: '🇹🇭', numbers: [{ label: L('Police', '警察'), number: '191' }, { label: L('Ambulance', '救护车'), number: '1669' }, { label: L('Tourist police', '旅游警察'), number: '1155' }], steps: STEPS, avoid: AVOID },
  { country: 'SG', name: L('Singapore', '新加坡'), flag: '🇸🇬', numbers: [{ label: L('Police', '警察'), number: '999' }, { label: L('Ambulance', '救护车'), number: '995' }], steps: STEPS, avoid: AVOID },
  { country: 'CN', name: L('China', '中国'), flag: '🇨🇳', numbers: [{ label: L('Police', '警察'), number: '110' }, { label: L('Ambulance', '救护车'), number: '120' }], steps: STEPS, avoid: AVOID },
  { country: 'JP', name: L('Japan', '日本'), flag: '🇯🇵', numbers: [{ label: L('Police', '警察'), number: '110' }, { label: L('Ambulance / Fire', '救护车 / 消防'), number: '119' }], steps: STEPS, avoid: AVOID },
  { country: 'AU', name: L('Australia', '澳大利亚'), flag: '🇦🇺', numbers: [{ label: L('Emergency', '紧急电话'), number: '000' }], steps: STEPS, avoid: AVOID },
];
/** Unknown locations must never inherit another country's phone numbers. */
export const incidentFor = (country: string): Incident => INCIDENTS.find((i) => i.country === country) ?? {
  country, name: L('Unreviewed destination — verify your location', '未核验目的地，请先确认所在国家'), flag: '', numbers: [],
  steps: [L('Seek official local emergency information now if help is urgent; do not wait for insurance intake or AI.', '如需紧急帮助，请立即查找官方当地紧急服务，不要等待保险问答或 AI。'), ...STEPS],
  avoid: AVOID,
};
