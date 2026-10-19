import { L } from '@/engine/l';

// Location-based suggestions (new feature). Matching is done on the device: the exact coordinates are reduced to the
// nearest city below and then discarded. City supplementary health schemes (惠民保) are real; prices are only given where
// a 2026 price was published, otherwise the app says to check the current price.

export type RiskId = 'typhoon' | 'flood' | 'dengue' | 'air' | 'quake' | 'traffic' | 'crossborder' | 'abroad' | 'heat';
export interface City {
  id: string; name: L; country: 'CN' | 'SG' | 'MY' | 'TH'; lat: number; lng: number;
  risks: RiskId[];
  /** City supplementary medical scheme (惠民保), mainland China only. */
  hmb?: { name: L; price?: L };
}

export const CITIES: City[] = [
  { id: 'shenzhen', name: L('Shenzhen', '深圳'), country: 'CN', lat: 22.543, lng: 114.058, risks: ['typhoon', 'flood', 'dengue', 'crossborder', 'traffic'], hmb: { name: L('Shenzhen Huiminbao', '深圳惠民保') } },
  { id: 'guangzhou', name: L('Guangzhou', '广州'), country: 'CN', lat: 23.129, lng: 113.264, risks: ['typhoon', 'flood', 'dengue', 'heat', 'traffic'], hmb: { name: L('Suisuikang', '穗岁康') } },
  { id: 'shanghai', name: L('Shanghai', '上海'), country: 'CN', lat: 31.230, lng: 121.474, risks: ['typhoon', 'flood', 'traffic'], hmb: { name: L('Huhuibao', '沪惠保'), price: L('¥129 a year (2026)', '每年 ¥129（2026 年）') } },
  { id: 'beijing', name: L('Beijing', '北京'), country: 'CN', lat: 39.904, lng: 116.407, risks: ['air', 'flood', 'traffic'], hmb: { name: L('Beijing Puhui Health Insurance', '北京普惠健康保'), price: L('¥195 a year (2026)', '每年 ¥195（2026 年）') } },
  { id: 'hangzhou', name: L('Hangzhou', '杭州'), country: 'CN', lat: 30.274, lng: 120.155, risks: ['typhoon', 'flood', 'traffic'], hmb: { name: L('Xihu Yilianbao', '西湖益联保') } },
  { id: 'chengdu', name: L('Chengdu', '成都'), country: 'CN', lat: 30.573, lng: 104.066, risks: ['quake', 'air', 'traffic'], hmb: { name: L('Huirongbao', '惠蓉保') } },
  { id: 'wuhan', name: L('Wuhan', '武汉'), country: 'CN', lat: 30.593, lng: 114.305, risks: ['flood', 'heat', 'traffic'], hmb: { name: L('Fuhankang', '福汉康') } },
  { id: 'singapore', name: L('Singapore', '新加坡'), country: 'SG', lat: 1.352, lng: 103.820, risks: ['abroad', 'dengue', 'heat'] },
  { id: 'kualalumpur', name: L('Kuala Lumpur', '吉隆坡'), country: 'MY', lat: 3.139, lng: 101.687, risks: ['abroad', 'dengue', 'flood'] },
  { id: 'bangkok', name: L('Bangkok', '曼谷'), country: 'TH', lat: 13.756, lng: 100.502, risks: ['abroad', 'dengue', 'flood', 'traffic'] },
];
export const cityById = (id: string) => CITIES.find((c) => c.id === id) ?? CITIES[0];
export const DEMO_CITY = 'shenzhen';

/** Great-circle distance in km. */
function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
export function nearestCity(lat: number, lng: number): { city: City; km: number } {
  return CITIES.map((city) => ({ city, km: km({ lat, lng }, city) })).sort((a, b) => a.km - b.km)[0];
}

export const RISK_LABEL: Record<RiskId, L> = {
  typhoon: L('Typhoon season (Jul–Oct)', '台风季（7–10 月）'),
  flood: L('Heavy rain and urban flooding', '暴雨和城市内涝'),
  dengue: L('Dengue fever', '登革热'),
  air: L('Air pollution days', '空气污染天'),
  quake: L('Earthquake zone', '地震带'),
  traffic: L('Busy roads and e-bike traffic', '道路繁忙、电动车多'),
  crossborder: L('Frequent trips to Hong Kong', '经常往返香港'),
  abroad: L('You are outside mainland China', '您在中国大陆境外'),
  heat: L('Extreme heat', '高温天气'),
};

export interface Suggestion {
  id: string; priority: 'high' | 'medium' | 'low'; icon: 'home' | 'heart' | 'plane' | 'car' | 'shield' | 'check';
  title: L; why: L; have: L; next: L; cite?: string; ask: L;
}

/** Rule-based suggestions from the city's risks and the user's current portfolio (which the agent already knows). */
export function suggestionsFor(city: City): Suggestion[] {
  const r = (x: RiskId) => city.risks.includes(x);
  const out: Suggestion[] = [];
  if (r('typhoon') || r('flood')) out.push({
    id: 'flood', priority: 'high', icon: 'home',
    title: L('Add flood cover to your home policy', '为家财险加上洪水保障'),
    why: L(`${city.name.en} has ${r('typhoon') ? 'typhoons and ' : ''}heavy rain that can flood homes from outside.`, `${city.name.zh}${r('typhoon') ? '有台风和' : '有'}暴雨，可能导致房屋从外部进水。`),
    have: L('Your PICC home policy excludes flood that starts outside the building [[HO-5.2]].', '您的人保家财险不保源自楼外的洪水 [[HO-5.2]]。'),
    next: L('Ask PICC for the flood extension on your existing policy. This is usually cheaper than a new policy.', '向中国人保咨询在现有保单上加保洪水扩展，通常比新买一份更便宜。'),
    cite: 'HO-5.2', ask: L('How do I add flood cover to my PICC home policy?', '怎么给我的人保家财险加洪水保障？'),
  });
  if (r('quake')) out.push({
    id: 'quake', priority: 'high', icon: 'home',
    title: L('Check earthquake cover for your home', '检查房屋的地震保障'),
    why: L(`${city.name.en} is in an earthquake zone.`, `${city.name.zh}位于地震带。`),
    have: L('Your home policy lists fire and water damage, not earthquake [[HO-2.1]].', '您的家财险列明了火灾和水渍，但不含地震 [[HO-2.1]]。'),
    next: L('Ask about an earthquake extension or a government-backed residential earthquake scheme.', '咨询地震扩展条款或政府支持的城乡居民住宅地震巨灾保险。'),
    cite: 'HO-2.1', ask: L('Is my home covered for earthquakes?', '我的房子有地震保障吗？'),
  });
  if (city.hmb) out.push({
    id: 'hmb', priority: 'medium', icon: 'heart',
    title: L(`Join ${city.hmb.name.en}`, `参加${city.hmb.name.zh}`),
    why: L('Your city\'s supplementary health scheme. Low price, no health questions, and it can pay for some pre-existing conditions and high-cost drugs.', '本市的惠民型商业补充医疗保险，价格低、不问健康状况，部分既往症和高额特药也能报销。'),
    have: L('Your Ping An medical plan excludes pre-existing conditions [[HS-6.2]]. The two work together.', '您的平安医疗险不保既往病症 [[HS-6.2]]，两者可以互补。'),
    next: city.hmb.price ? L(`Price: ${city.hmb.price.en}. Enrol through the official city channel during the enrolment window.`, `价格：${city.hmb.price.zh}。请在参保期内通过官方渠道参保。`) : L('Check this year\'s price and enrolment window on the official city channel.', '请通过官方渠道查看今年的价格和参保时间。'),
    cite: 'HS-6.2', ask: L(`Should I join ${city.hmb.name.en}?`, `我要不要参加${city.hmb.name.zh}？`),
  });
  if (r('dengue')) out.push({
    id: 'dengue', priority: 'low', icon: 'check',
    title: L('Dengue: you are already covered', '登革热：您已有保障'),
    why: L(`Dengue cases occur in ${city.name.en}, mostly in summer and autumn.`, `${city.name.zh}夏秋季有登革热病例。`),
    have: L('Hospital stays for dengue are covered by your Ping An plan [[HS-3.4]].', '您的平安医疗险已覆盖登革热住院 [[HS-3.4]]。'),
    next: L('No need to buy more. Use mosquito protection.', '无需额外购买，做好防蚊即可。'),
    cite: 'HS-3.4', ask: L('Am I covered for dengue hospitalisation?', '登革热住院在保障范围内吗？'),
  });
  if (r('crossborder')) out.push({
    id: 'multitrip', priority: 'medium', icon: 'plane',
    title: L('Annual multi-trip travel cover', '全年多次往返旅行险'),
    why: L('You live next to Hong Kong. Buying single-trip cover each time adds up.', '您住在香港旁边，每次单独买旅行险累计下来并不便宜。'),
    have: L('Your CPIC travel policy covers only the Thailand trip [[TR-3.1]].', '您的太保旅行险仅涵盖泰国行程 [[TR-3.1]]。'),
    next: L('Compare an annual multi-trip plan that includes Hong Kong and Macau.', '比较包含港澳的全年多次往返计划。'),
    cite: 'TR-3.1', ask: L('Compare annual multi-trip travel cover for me', '帮我比较全年多次往返旅行险'),
  });
  if (r('abroad')) out.push({
    id: 'abroad', priority: 'high', icon: 'plane',
    title: L('Make sure you have overseas medical cover here', '确认在当地有海外医疗保障'),
    why: L(`Hospital bills in ${city.name.en} can be high, and many mainland medical plans only pay inside mainland China.`, `${city.name.zh}的医疗费用可能很高，很多大陆医疗险只保中国大陆境内。`),
    have: L('Your CPIC travel cover is for 20 Dec – 3 Jan only [[TR-3.1]].', '您的太保旅行险仅限 12 月 20 日至 1 月 3 日 [[TR-3.1]]。'),
    next: L('If you are here outside those dates, buy travel cover before you need it. It cannot be bought after an incident.', '如果不在上述日期内，请提前购买旅行险，事故发生后无法再买。'),
    cite: 'TR-3.1', ask: L('Am I covered for treatment abroad right now?', '我现在在境外看病有保障吗？'),
  });
  if (r('traffic')) out.push({
    id: 'traffic', priority: 'low', icon: 'car',
    title: L('Road accidents: mostly covered', '道路意外：基本有保障'),
    why: L('Busy roads and many e-bikes mean more minor accidents.', '道路繁忙、电动车多，小事故较常见。'),
    have: L('Your China Life accident plan and CPIC motor plan cover this, but not paid delivery work [[PA-5.4]].', '您的国寿意外险和太保车险已覆盖，但不含有偿配送工作 [[PA-5.4]]。'),
    next: L('Only act if you ride or drive for a delivery platform.', '只有在为配送平台骑行或驾车时才需要处理。'),
    cite: 'PA-5.4', ask: L('I also do food delivery part-time. Am I covered?', '我还兼职送外卖，有保障吗？'),
  });
  if (r('air')) out.push({
    id: 'air', priority: 'medium', icon: 'heart',
    title: L('Outpatient cover for respiratory visits', '呼吸道门诊保障'),
    why: L('Pollution days bring more coughs and asthma visits, mostly as outpatients.', '污染天气会增加咳嗽、哮喘等门诊就诊。'),
    have: L('Outpatient visits not linked to a hospital stay are not covered [[HS-9.1]].', '与住院无关的门诊不在保障范围内 [[HS-9.1]]。'),
    next: L('Compare outpatient add-ons, especially for your child.', '比较门诊附加险，尤其是孩子的。'),
    cite: 'HS-9.1', ask: L('Compare outpatient cover for me and my child', '帮我比较我和孩子的门诊保障'),
  });
  const rank = { high: 0, medium: 1, low: 2 } as const;
  return out.sort((a, b) => rank[a.priority] - rank[b.priority]);
}
