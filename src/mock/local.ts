// Cross-border kit (PRD A4 / C6): policy facts written in the language of the country the user is in,
// so they can be shown to hospital staff, police or the other party. Synthetic policy, fictional insurer.

export type LocalLang = 'en' | 'zh' | 'th' | 'ms' | 'ja';

export interface LocalPack {
  lang: LocalLang;
  label: string; // language name in that language
  title: string;
  intro: string;
  facts: { label: string; value: string }[];
  ask: string;
  report: (country: string) => string;
  /** How the app labels the hotline button in that language. */
  call: string;
}

const POLICY_NO = 'SG-2026-77****05';
/** CPIC's national service hotline (95500). From abroad, use the overseas number printed on the policy card. */
export const ASSIST_LINE = '95500';
const INSURER = 'China Pacific Insurance (CPIC)';

export const LOCAL: Record<LocalLang, LocalPack> = {
  en: {
    lang: 'en', label: 'English', title: 'Please help: I have travel insurance',
    intro: 'I am a traveller with travel insurance. Please contact my insurer\'s 24-hour assistance line. They can guarantee payment to the hospital, so I do not have to pay upfront.',
    facts: [
      { label: 'Insurer', value: INSURER }, { label: 'Policy no.', value: POLICY_NO },
      { label: 'Overseas medical cover', value: 'up to ¥500,000' }, { label: 'Cover period', value: '20 Dec 2026 – 3 Jan 2027' },
      { label: '24-hour assistance', value: ASSIST_LINE },
    ],
    ask: 'Please send the medical report and the itemised bill to the insurer.',
    report: (c) => `Incident report. Country: ${c}. Reporter: M** L** T**. Policy: ${POLICY_NO}. Date: 2026-10-14. Please contact the assistance provider printed on the issued policy promptly and check its notification requirements.`,
    call: 'Call assistance',
  },
  zh: {
    lang: 'zh', label: '中文', title: '请帮帮我：我有旅行保险',
    intro: '我是购买了旅行保险的旅客。请联系我的保险公司 24 小时救援热线，他们可以向医院出具付款担保，我无需先行垫付。',
    facts: [
      { label: '保险公司', value: '中国太平洋保险 CPIC' }, { label: '保单号', value: POLICY_NO },
      { label: '海外医疗保障', value: '最高 ¥500,000' }, { label: '保障期间', value: '2026-12-20 至 2027-01-03' },
      { label: '24 小时救援', value: ASSIST_LINE },
    ],
    ask: '请把病历和费用明细账单发送给保险公司。',
    report: (c) => `事故报告。国家：${c}。报案人：M** L** T**。保单：${POLICY_NO}。日期：2026-10-14。请及时联系已签发保单列明的协助机构，并核对实际通知要求。`,
    call: '拨打救援热线',
  },
  th: {
    lang: 'th', label: 'ภาษาไทย', title: 'กรุณาช่วยด้วย: ฉันมีประกันการเดินทาง',
    intro: 'ฉันเป็นนักท่องเที่ยวที่มีประกันการเดินทาง กรุณาติดต่อศูนย์ช่วยเหลือ 24 ชั่วโมงของบริษัทประกัน บริษัทประกันสามารถออกหนังสือรับรองการชำระเงินให้โรงพยาบาลได้ ฉันจึงไม่ต้องสำรองจ่ายก่อน',
    facts: [
      { label: 'บริษัทประกัน', value: INSURER }, { label: 'เลขที่กรมธรรม์', value: POLICY_NO },
      { label: 'ค่ารักษาพยาบาลในต่างประเทศ', value: 'สูงสุด ¥500,000' }, { label: 'ระยะเวลาคุ้มครอง', value: '20 ธ.ค. 2026 – 3 ม.ค. 2027' },
      { label: 'ศูนย์ช่วยเหลือ 24 ชั่วโมง', value: ASSIST_LINE },
    ],
    ask: 'กรุณาส่งรายงานทางการแพทย์และใบแจ้งค่าใช้จ่ายแยกรายการให้บริษัทประกัน',
    report: (c) => `รายงานเหตุการณ์ ประเทศ: ${c} ผู้แจ้ง: M** L** T** กรมธรรม์: ${POLICY_NO} วันที่: 2026-10-14 กรุณาติดต่อผู้ให้บริการช่วยเหลือที่ระบุในกรมธรรม์โดยเร็ว และตรวจสอบข้อกำหนดการแจ้งเหตุ`,
    call: 'โทรหาศูนย์ช่วยเหลือ',
  },
  ms: {
    lang: 'ms', label: 'Bahasa Melayu', title: 'Tolong bantu: saya ada insurans perjalanan',
    intro: 'Saya seorang pelancong yang mempunyai insurans perjalanan. Sila hubungi talian bantuan 24 jam syarikat insurans saya. Mereka boleh memberi jaminan bayaran kepada hospital, jadi saya tidak perlu membayar dahulu.',
    facts: [
      { label: 'Syarikat insurans', value: INSURER }, { label: 'No. polisi', value: POLICY_NO },
      { label: 'Perlindungan perubatan luar negara', value: 'sehingga ¥500,000' }, { label: 'Tempoh perlindungan', value: '20 Dis 2026 – 3 Jan 2027' },
      { label: 'Talian bantuan 24 jam', value: ASSIST_LINE },
    ],
    ask: 'Sila hantar laporan perubatan dan bil terperinci kepada syarikat insurans.',
    report: (c) => `Laporan insiden. Negara: ${c}. Pelapor: M** L** T**. Polisi: ${POLICY_NO}. Tarikh: 2026-10-14. Sila hubungi penyedia bantuan yang tertera pada polisi dengan segera dan semak keperluan pemberitahuannya.`,
    call: 'Hubungi talian bantuan',
  },
  ja: {
    lang: 'ja', label: '日本語', title: '助けてください：旅行保険に加入しています',
    intro: '私は旅行保険に加入している旅行者です。保険会社の24時間アシスタンスデスクに連絡してください。病院への支払い保証を手配できるため、私が立て替える必要はありません。',
    facts: [
      { label: '保険会社', value: INSURER }, { label: '証券番号', value: POLICY_NO },
      { label: '海外治療費用', value: '最大 ¥500,000' }, { label: '保険期間', value: '2026年12月20日～2027年1月3日' },
      { label: '24時間アシスタンス', value: ASSIST_LINE },
    ],
    ask: '診断書と明細付きの請求書を保険会社に送ってください。',
    report: (c) => `事故報告。国：${c}。報告者：M** L** T**。証券番号：${POLICY_NO}。日付：2026-10-14。保険証券に記載のアシスタンス窓口へ速やかに連絡し、通知要件を確認してください。`,
    call: 'アシスタンスに電話',
  },
};

/** The language people speak where the incident happened, plus the country name in that language. */
export const COUNTRY_LOCAL: Record<string, { lang: LocalLang; name: string }> = {
  TH: { lang: 'th', name: 'ประเทศไทย' },
  MY: { lang: 'ms', name: 'Malaysia' },
  JP: { lang: 'ja', name: '日本' },
  CN: { lang: 'zh', name: '中国' },
  SG: { lang: 'en', name: 'Singapore' },
  AU: { lang: 'en', name: 'Australia' },
};
export const localFor = (country: string) => COUNTRY_LOCAL[country] ?? { lang: 'en' as LocalLang, name: country };

// ── Parties the user can connect with the insurer (PRD C6 "connect the party involved") ──
export type PartyKind = 'hospital' | 'police' | 'driver';
export interface PartyMsg { from: 'party' | 'insurer'; local: Partial<Record<LocalLang, string>>; en: string; zh: string }
export interface PartyTemplate {
  kind: PartyKind;
  name: { en: string; zh: string };
  contact: string;
  shares: { en: string; zh: string }[];
  steps: { en: string; zh: string }[]; // status updates as the case progresses
  reply: PartyMsg;
}

export const PARTIES: Record<PartyKind, PartyTemplate> = {
  hospital: {
    kind: 'hospital', name: { en: 'Riverside International Hospital (treating hospital)', zh: '河畔国际医院（就诊医院）' }, contact: '+66 2 000 0199',
    shares: [{ en: 'Policy number (masked)', zh: '保单号（已脱敏）' }, { en: 'Incident report in the local language', zh: '当地语言事故报告' }, { en: 'Request: medical report and estimated bill', zh: '请求：病历和费用估算' }],
    steps: [
      { en: 'Case TA-58213 opened with CPIC assistance', zh: '已在中国太保救援中心开立案件 TA-58213' },
      { en: 'Secure link sent to the hospital in their language (expires in 72 h)', zh: '已用对方语言向医院发送安全链接（72 小时内有效）' },
      { en: 'Hospital joined the case', zh: '医院已加入案件' },
      { en: 'Hospital uploaded the medical report and an estimated bill of ¥42,000', zh: '医院已上传病历及约 ¥42,000 的费用估算' },
      { en: 'Insurer sent a guarantee of payment to the hospital. You don\'t need to pay upfront.', zh: '保险公司已向医院出具付款担保，您无需先行垫付。' },
    ],
    reply: { from: 'party', local: { th: 'ได้รับแล้วค่ะ จะส่งรายงานทางการแพทย์ให้ภายใน 1 ชั่วโมง', ms: 'Diterima. Kami akan hantar laporan perubatan dalam masa 1 jam.', ja: '受け取りました。1時間以内に診断書を送ります。' }, en: 'Received. We will send the medical report within 1 hour.', zh: '已收到，我们会在 1 小时内发送病历。' },
  },
  police: {
    kind: 'police', name: { en: 'Tourist Police station', zh: '旅游警察局' }, contact: '1155',
    shares: [{ en: 'Incident report in the local language', zh: '当地语言事故报告' }, { en: 'Request: copy of the police report', zh: '请求：警方报告副本' }],
    steps: [
      { en: 'Case TA-58213 opened with CPIC assistance', zh: '已在中国太保救援中心开立案件 TA-58213' },
      { en: 'Request sent to the police station in their language', zh: '已用对方语言向警察局发送请求' },
      { en: 'Police acknowledged: report no. TP-2026-10-3318', zh: '警方已确认：报告编号 TP-2026-10-3318' },
      { en: 'Police report attached to your claim file (needed under TR-7.5)', zh: '警方报告已附入理赔档案（TR-7.5 要求）' },
    ],
    reply: { from: 'party', local: { th: 'รับทราบ เลขที่รายงาน TP-2026-10-3318', ms: 'Diterima. No. laporan TP-2026-10-3318.', ja: '了解しました。報告番号 TP-2026-10-3318。' }, en: 'Acknowledged. Report no. TP-2026-10-3318.', zh: '已确认，报告编号 TP-2026-10-3318。' },
  },
  driver: {
    kind: 'driver', name: { en: 'Other driver and their insurer', zh: '对方司机及其保险公司' }, contact: '+66 8 0000 4521',
    shares: [{ en: 'Your name and policy number (masked)', zh: '您的姓名和保单号（已脱敏）' }, { en: 'Photos of the scene', zh: '现场照片' }, { en: 'Request: their insurer and policy details', zh: '请求：对方的保险公司及保单信息' }],
    steps: [
      { en: 'Case TA-58213 opened with CPIC assistance', zh: '已在中国太保救援中心开立案件 TA-58213' },
      { en: 'Secure link sent to the other driver in their language', zh: '已用对方语言向对方司机发送安全链接' },
      { en: 'Other driver shared their insurer: Chao Phraya Motor Insurance (fictional)', zh: '对方已提供其保险公司：湄南河车险（虚构）' },
      { en: 'Both insurers are now talking directly. You don\'t need to negotiate on the street.', zh: '双方保险公司已直接对接，您无需在现场自行协商。' },
    ],
    reply: { from: 'party', local: { th: 'ประกันของผมคือ Chao Phraya Motor Insurance ครับ', ms: 'Insurans saya ialah Chao Phraya Motor Insurance.', ja: '私の保険会社はChao Phraya Motor Insuranceです。' }, en: 'My insurer is Chao Phraya Motor Insurance.', zh: '我的保险公司是湄南河车险。' },
  },
};
