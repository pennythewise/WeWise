import { L } from '@/engine/l';
import type { InsuranceType } from './products';
import { POLICIES } from './policies';

// Marketplace catalogue (选保险). Prices are computed by `quote()` below, never by the LLM; all figures are illustrative.

export type Answers = Record<string, string | number | boolean>;
export type PriceUnit = 'month' | 'year' | 'trip';

export interface ShopProduct {
  id: string;
  insurerId: string;
  type: InsuranceType;
  name: L;
  tagline: L;
  /** Price at factor 1 (a reference customer), in `unit`. */
  base: number;
  rating: number;
  /** Average days from claim filed to payout. */
  claimDays: number;
  /** Values for the three CATEGORY_SPECS labels of this type. */
  specs: [L, L, L];
  fills?: 'outpatient';
}

interface Opt { v: string; label: L; f: number }
export type QuoteField =
  | { kind: 'number'; key: string; label: L; min: number; max: number; def: number; /** Typical customer span, used for the pre-quote price range. */ typ: [number, number]; curve: (n: number) => number }
  | { kind: 'select'; key: string; label: L; def: string; options: Opt[] }
  | { kind: 'toggle'; key: string; label: L; def: boolean; on: number };

const AGE = (curve: (n: number) => number): QuoteField => ({ kind: 'number', key: 'age', label: L('Age', '年龄'), min: 0, max: 65, def: 29, typ: [20, 50], curve });
const SEX: QuoteField = { kind: 'select', key: 'sex', label: L('Sex', '性别'), def: 'f', options: [{ v: 'f', label: L('Female', '女'), f: 1 }, { v: 'm', label: L('Male', '男'), f: 1.1 }] };
const SMOKER: QuoteField = { kind: 'toggle', key: 'smoker', label: L('Smoker', '吸烟'), def: false, on: 1.35 };
const sel = (key: string, label: L, def: string, options: [string, L, number][]): QuoteField => ({ kind: 'select', key, label, def, options: options.map(([v, l, f]) => ({ v, label: l, f })) });
const CITY = sel('city', L('City tier', '所在城市'), 't1', [['t1', L('Tier 1 (e.g. Shenzhen)', '一线城市（如深圳）'), 1.15], ['t2', L('Tier 2', '二线城市'), 1], ['t3', L('Other', '其他城市'), 0.9]]);

export interface CategoryMeta { unit: PriceUnit; specLabels: [L, L, L]; fields: QuoteField[]; needsDeclaration: boolean }
export const CATEGORIES: Record<InsuranceType, CategoryMeta> = {
  medical: { unit: 'month', needsDeclaration: true, specLabels: [L('Annual limit', '年度限额'), L('Deductible', '免赔额'), L('Hospital room', '住院房型')], fields: [
    AGE((n) => 1 + Math.max(0, n - 25) * 0.045), SEX, SMOKER,
    { kind: 'toggle', key: 'social', label: L('Covered by social insurance', '有社保'), def: true, on: 0.85 },
    sel('deductible', L('Deductible', '免赔额'), '1', [['0.5', L('¥5,000', '5千'), 1.15], ['1', L('¥10,000', '1万'), 1], ['2', L('¥20,000', '2万'), 0.85]]),
  ] },
  critical: { unit: 'month', needsDeclaration: true, specLabels: [L('Sum insured', '保额'), L('Illnesses covered', '保障病种'), L('Cover period', '保障期限')], fields: [
    AGE((n) => 0.45 + 0.03 * n), SEX, SMOKER,
    sel('sum', L('Sum insured', '保额'), '50', [['30', L('¥300,000', '30万'), 0.6], ['50', L('¥500,000', '50万'), 1], ['100', L('¥1,000,000', '100万'), 2]]),
    sel('term', L('Cover period', '保障期限'), '70', [['20', L('20 years', '20 年'), 0.8], ['70', L('To age 70', '至 70 岁'), 1], ['life', L('Whole life', '终身'), 1.9]]),
  ] },
  life: { unit: 'month', needsDeclaration: true, specLabels: [L('Sum insured', '保额'), L('Cover period', '保障期限'), L('Waiting period', '等待期')], fields: [
    AGE((n) => 0.4 + 0.035 * n), SEX, SMOKER,
    sel('sum', L('Sum insured', '保额'), '100', [['50', L('¥500,000', '50万'), 0.55], ['100', L('¥1,000,000', '100万'), 1], ['200', L('¥2,000,000', '200万'), 1.9]]),
    sel('term', L('Term', '保障期限'), '20', [['20', L('20 years', '20 年'), 1], ['30', L('30 years', '30 年'), 1.35]]),
  ] },
  accident: { unit: 'month', needsDeclaration: false, specLabels: [L('Accidental death / disability', '意外身故/伤残'), L('Accident medical', '意外医疗'), L('Sports cover', '运动保障')], fields: [
    sel('job', L('Occupation class', '职业类别'), '1', [['1', L('Class 1–2 (office, teacher)', '1–2 类（办公室、教师）'), 1], ['3', L('Class 3–4 (sales, driver)', '3–4 类（销售、司机）'), 1.5], ['5', L('Class 5–6 (manual, height work)', '5–6 类（体力、高空）'), 2.4]]),
    sel('sum', L('Sum insured', '保额'), '50', [['30', L('¥300,000', '30万'), 0.65], ['50', L('¥500,000', '50万'), 1], ['100', L('¥1,000,000', '100万'), 1.8]]),
  ] },
  travel: { unit: 'trip', needsDeclaration: false, specLabels: [L('Medical cover', '医疗额度'), L('Flight delay', '航班延误'), L('Baggage', '行李')], fields: [
    sel('dest', L('Destination', '目的地'), 'asia', [['hk', L('Hong Kong / Macau / Taiwan', '港澳台'), 0.7], ['asia', L('Asia', '亚洲'), 1], ['west', L('Europe / Americas', '欧美'), 1.6]]),
    { kind: 'number', key: 'days', label: L('Trip length (days)', '出行天数'), min: 1, max: 90, def: 7, typ: [3, 14], curve: (n) => 0.3 + 0.1 * n },
    { kind: 'number', key: 'people', label: L('Travellers', '出行人数'), min: 1, max: 6, def: 1, typ: [1, 2], curve: (n) => n },
    { kind: 'number', key: 'age', label: L('Oldest traveller age', '最年长出行者年龄'), min: 0, max: 80, def: 29, typ: [25, 55], curve: (n) => (n > 60 ? 2.2 : n > 45 ? 1.3 : 1) },
  ] },
  motor: { unit: 'year', needsDeclaration: false, specLabels: [L('Third-party liability', '第三者责任'), L('Own damage', '车损险'), L('Extras', '附加服务')], fields: [
    sel('car', L('Car value', '车辆价值'), 'mid', [['low', L('Under ¥100k', '10 万以下'), 0.7], ['mid', L('¥100–200k', '10–20 万'), 1], ['high', L('¥200–400k', '20–40 万'), 1.5], ['lux', L('Over ¥400k', '40 万以上'), 2.2]]),
    CITY,
    sel('ncd', L('Claim-free years', '连续未出险年数'), '0', [['0', L('0', '0 年'), 1], ['1', L('1', '1 年'), 0.9], ['2', L('2', '2 年'), 0.8], ['3', L('3 or more', '3 年及以上'), 0.7]]),
  ] },
  home: { unit: 'month', needsDeclaration: false, specLabels: [L('Building', '房屋主体'), L('Contents', '室内财产'), L('Water damage', '水管爆裂')], fields: [
    sel('value', L('Home value', '房屋价值'), 'mid', [['low', L('Under ¥1M', '100 万以下'), 0.6], ['mid', L('¥1–3M', '100–300 万'), 1], ['high', L('Over ¥3M', '300 万以上'), 1.8]]),
    CITY,
    sel('use', L('Use', '用途'), 'own', [['own', L('Owner-occupied', '自住'), 1], ['rent', L('Rented out', '出租'), 1.25]]),
  ] },
};

const P = (id: string, insurerId: string, type: InsuranceType, en: string, zh: string, tagEn: string, tagZh: string, base: number, rating: number, claimDays: number, specs: [L, L, L], fills?: 'outpatient'): ShopProduct =>
  ({ id, insurerId, type, name: L(en, zh), tagline: L(tagEn, tagZh), base, rating, claimDays, specs, fills });
const s = (e: string, z = e) => L(e, z);

export const SHOP_PRODUCTS: ShopProduct[] = [
  P('shop_med_1', 'orchid', 'medical', 'ZhongAn Zunxiang e-Sheng', '众安尊享e生', 'Smooth premiums, capped yearly rises', '保费平缓，年度涨幅有上限', 170, 4.7, 3, [s('¥3M', '300万'), s('¥10k', '1万'), s('Single room', '单人房')]),
  P('shop_med_2', 'harbour', 'medical', 'Ping An e-Sheng Bao Plus', '平安e生保·门诊加强版', 'Adds outpatient cover to the million-yuan plan', '百万医疗，加含门诊保障', 205, 4.5, 4, [s('¥2M', '200万'), s('¥10k', '1万'), s('Single room + outpatient', '单人房 + 门诊')], 'outpatient'),
  P('shop_med_3', 'banyan', 'medical', 'PICC Haoyibao Long-term Medical', '人保健康好医保·长期医疗', 'Lowest starting price, price rises by age', '起步价最低，按年龄段调价', 150, 4.2, 5, [s('¥1M', '100万'), s('¥10k', '1万'), s('Standard ward', '普通病房')]),
  P('shop_ci_1', 'pinnacle', 'critical', 'China Life Guoshoufu CI', '国寿福重大疾病保险', 'Level premium, 100+ illnesses', '保费不变，100+ 种重疾', 115, 4.6, 6, [s('Up to ¥1M', '最高 100万'), s('120 illnesses', '120 种'), s('To age 70 / whole life', '至70岁/终身')]),
  P('shop_ci_2', 'orchid', 'critical', 'ZhongAn Critical Illness', '众安重疾险', 'Fast online claims, multiple payouts', '线上快赔，多次赔付', 105, 4.4, 3, [s('Up to ¥1M', '最高 100万'), s('100 illnesses + 50 early-stage', '100 种 + 50 种轻症'), s('To age 70', '至70岁')]),
  P('shop_ci_3', 'sunrise', 'critical', 'CPIC Family Critical Care', '太保家庭守护重疾', 'Includes child cover at no extra cost', '含儿童保障，无需额外付费', 128, 4.3, 5, [s('Up to ¥1M', '最高 100万'), s('110 illnesses', '110 种'), s('Whole life', '终身')]),
  P('shop_life_1', 'pinnacle', 'life', 'China Life Term Life 20', '国寿 20 年定期寿险', 'Pure protection, level for 20 years', '纯保障，20 年保费不变', 40, 4.6, 7, [s('Up to ¥2M', '最高 200万'), s('20 / 30 years', '20/30 年'), s('30 days', '30 天')]),
  P('shop_life_2', 'harbour', 'life', 'Ping An Fubao Term Life', '平安福宝定期寿险', 'Includes accident-death double payout', '含意外身故双倍赔付', 44, 4.4, 6, [s('Up to ¥2M', '最高 200万'), s('20 / 30 years', '20/30 年'), s('90 days', '90 天')]),
  P('shop_life_3', 'orchid', 'life', 'ZhongAn Term Life Online', '众安在线定期寿险', 'Fully online application, no medical exam up to ¥500k', '全程线上投保，50万以内免体检', 36, 4.2, 4, [s('Up to ¥1M', '最高 100万'), s('20 years', '20 年'), s('30 days', '30 天')]),
  P('shop_pa_1', 'pinnacle', 'accident', 'China Life Personal Accident', '国寿意外伤害保险', 'Reliable all-round accident cover', '全面的日常意外保障', 28, 4.5, 4, [s('Up to ¥1M', '最高 100万'), s('¥50k', '5万'), s('Excluded', '不含')]),
  P('shop_pa_2', 'banyan', 'accident', 'PICC Everyday Accident', '人保日常意外险', 'Low price, includes sports cover', '价格低，含运动保障', 24, 4.1, 5, [s('Up to ¥500k', '最高 50万'), s('¥30k', '3万'), s('Included', '含')]),
  P('shop_pa_3', 'orchid', 'accident', 'ZhongAn Active Accident', '众安运动意外险', 'Covers skiing, diving and drone flying', '含滑雪、潜水、无人机', 33, 4.4, 3, [s('Up to ¥1M', '最高 100万'), s('¥50k', '5万'), s('Included incl. extreme', '含高风险运动')]),
  P('shop_tr_1', 'sunrise', 'travel', 'CPIC Overseas Travel', '太保境外旅行险', 'Strong medical cover for Asia trips', '亚洲出行医疗保障强', 48, 4.5, 4, [s('¥500k', '50万'), s('¥600 after 4h', '延误4小时赔600'), s('¥3,000', '3千')]),
  P('shop_tr_2', 'orchid', 'travel', 'ZhongAn Globetrotter', '众安环球行', 'Instant policy, covers COVID-19 treatment', '即买即生效，含新冠治疗', 42, 4.3, 3, [s('¥300k', '30万'), s('¥400 after 3h', '延误3小时赔400'), s('¥2,000', '2千')]),
  P('shop_tr_3', 'harbour', 'travel', 'Ping An Premium Travel', '平安尊享旅行险', '24h assistance hotline and medical evacuation', '24 小时救援与医疗转运', 66, 4.6, 5, [s('¥1M', '100万'), s('¥800 after 4h', '延误4小时赔800'), s('¥5,000', '5千')]),
  P('shop_mo_1', 'sunrise', 'motor', 'CPIC Motor Commercial Insurance', '太保机动车商业保险', 'Full cover with 24h roadside rescue', '全险，含 24 小时道路救援', 3200, 4.5, 4, [s('¥2M', '200万'), s('Included', '含'), s('Roadside rescue, 4 free services', '道路救援，4次免费')]),
  P('shop_mo_2', 'harbour', 'motor', 'Ping An Motor Comprehensive', '平安车险·综合保障', 'Direct payment to repair shops, no upfront cost', '直赔修理厂，无需垫付', 3350, 4.6, 3, [s('¥3M', '300万'), s('Included', '含'), s('Free repairs pick-up', '免费接送修')]),
  P('shop_mo_3', 'banyan', 'motor', 'PICC Motor Value', '人保车险·实惠版', 'Lowest price, standard cover', '价格最低，基础保障', 2850, 4.1, 6, [s('¥1M', '100万'), s('Included', '含'), s('Roadside rescue, 2 free services', '道路救援，2次免费')]),
  P('shop_ho_1', 'banyan', 'home', 'PICC Home Property Insurance', '人保家庭财产保险', 'Building and contents, water damage included', '房屋及室内财产，含水管爆裂', 38, 4.3, 5, [s('¥2M', '200万'), s('¥200k', '20万'), s('Included', '含')]),
  P('shop_ho_2', 'harbour', 'home', 'Ping An Home Guard', '平安家庭守护', 'Adds theft and liability cover', '含盗抢和家庭责任', 46, 4.5, 4, [s('¥3M', '300万'), s('¥300k', '30万'), s('Included', '含')]),
  P('shop_ho_3', 'orchid', 'home', 'ZhongAn Renter Shield', '众安租客保', 'Built for renters, contents-only', '为租客设计，仅含室内财产', 22, 4.2, 3, [s('Not covered', '不含'), s('¥100k', '10万'), s('Included', '含')]),
];
export const shopProductById = (id: string) => SHOP_PRODUCTS.find((p) => p.id === id);
export const productsOfType = (t: InsuranceType) => SHOP_PRODUCTS.filter((p) => p.type === t);
export const SHOP_TYPES: InsuranceType[] = ['medical', 'critical', 'accident', 'life', 'travel', 'motor', 'home'];

export function defaultAnswers(type: InsuranceType): Answers {
  return Object.fromEntries(CATEGORIES[type].fields.map((f) => [f.key, f.def]));
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
function fieldFactor(f: QuoteField, v: string | number | boolean): number {
  if (f.kind === 'number') return f.curve(clamp(Number(v) || f.def, f.min, f.max));
  if (f.kind === 'toggle') return v ? f.on : 1;
  return f.options.find((o) => o.v === v)?.f ?? 1;
}
/** Pure pricing: product base × the factor of every answered field. Missing answers fall back to the field default. */
export function quote(p: ShopProduct, answers?: Answers): number {
  let price = p.base;
  for (const f of CATEGORIES[p.type].fields) price *= fieldFactor(f, answers?.[f.key] ?? f.def);
  return Math.round(price);
}

/** Answers held at their default in the pre-quote range: plan choices (sum, term, deductible, car, home value) and inputs that would stretch it too wide. The range then mostly reflects age, trip length, city and claim history. */
const RANGE_FIXED = new Set(['sum', 'term', 'deductible', 'car', 'value', 'sex', 'smoker', 'people', 'dest']);
/** Price span before the user has answered the quote form: cheapest to dearest combination of typical customer answers. */
export function priceRange(p: ShopProduct): [number, number] {
  let lo = p.base, hi = p.base;
  for (const f of CATEGORIES[p.type].fields) {
    const fs = RANGE_FIXED.has(f.key) ? [fieldFactor(f, f.def)] : f.kind === 'number' ? f.typ.map(f.curve) : f.kind === 'toggle' ? [1, f.on] : f.options.map((o) => o.f);
    lo *= Math.min(...fs); hi *= Math.max(...fs);
  }
  return [Math.round(lo), Math.round(hi)];
}

/** Comparable cost for sorting across categories: yearly for monthly plans, otherwise the plan price. Uses the exact quote once answered, else the bottom of the range. */
export function sortCost(p: ShopProduct, answers?: Answers): number {
  const n = answers ? quote(p, answers) : priceRange(p)[0];
  return CATEGORIES[p.type].unit === 'month' ? n * 12 : n;
}

export interface Recommendation { product: ShopProduct; reason: L }
/** "For you": categories the user owns nothing in, plus products that close a gap noted on an existing policy. */
export function recommendations(): Recommendation[] {
  const owned = new Set(POLICIES.map((p) => p.type));
  const best = (t: InsuranceType) => [...productsOfType(t)].sort((a, b) => b.rating - a.rating)[0];
  const out: Recommendation[] = [];
  const outpatient = SHOP_PRODUCTS.find((p) => p.fills === 'outpatient');
  if (outpatient && POLICIES.some((p) => p.type === 'medical' && p.gap)) out.push({ product: outpatient, reason: L('Fills the outpatient gap in your current medical plan', '补上你现有医疗险的门诊缺口') });
  for (const t of ['critical', 'life'] as const) if (!owned.has(t)) out.push({ product: best(t), reason: t === 'critical' ? L('You have no critical illness cover yet', '你还没有重疾保障') : L('You have no life cover, and you have a dependant child', '你还没有寿险，且有年幼的孩子') });
  return out;
}
