import { L } from '@/engine/l';
import { insurerById } from './insurers';
import { POLICIES } from './policies';
import { CATEGORIES, priceRange, quote, SHOP_PRODUCTS, type Answers, type ShopProduct } from './shop';

// Pure comparison logic for the marketplace → 问微晓 flow: rows for the card and the written analysis. No LLM involved in any number.

export type Dimension = 'overall' | 'coverage' | 'price' | 'claims' | 'fit';
export const DIMENSIONS: { key: Dimension; label: L; chip: L }[] = [
  { key: 'overall', label: L('overall', '综合'), chip: L('Overall comparison', '综合对比') },
  { key: 'coverage', label: L('coverage', '保障范围'), chip: L('Coverage details', '保障范围') },
  { key: 'price', label: L('price', '价格费用'), chip: L('Price and cost', '价格与费用') },
  { key: 'claims', label: L('claims', '理赔体验'), chip: L('Claims experience', '理赔体验') },
  { key: 'fit', label: L('fit for me', '适合我吗'), chip: L('Fit for me', '适合我吗') },
];
export const dimensionMarker = (d: Dimension): L => { const x = DIMENSIONS.find((y) => y.key === d)!.label; return L(`(${x.en})`, `（${x.zh}）`); };
/** Reads the dimension back out of a chip message such as "Compare these plans (coverage): A vs B". */
export function parseDimension(text: string): Dimension {
  return DIMENSIONS.find((d) => text.includes(`(${d.label.en})`) || text.includes(`（${d.label.zh}）`))?.key ?? 'overall';
}
/** Finds the products named in a message, in the order they appear. */
export function parseProducts(text: string): ShopProduct[] {
  return SHOP_PRODUCTS.flatMap((p) => { const i = Math.min(...[p.name.en, p.name.zh].map((n) => (text.includes(n) ? text.indexOf(n) : Infinity))); return Number.isFinite(i) ? [{ p, i }] : []; })
    .sort((a, b) => a.i - b.i).map((x) => x.p);
}

const money = (n: number) => `¥${Math.round(n).toLocaleString('en-US')}`;
const same = (s: string) => L(s, s);
const unit = (p: ShopProduct) => ({ month: L('/mo', '/月'), year: L('/yr', '/年'), trip: L('/trip', '/次') })[CATEGORIES[p.type].unit];
const yearly = (p: ShopProduct, a?: Answers) => { const n = quote(p, a); return CATEGORIES[p.type].unit === 'month' ? n * 12 : n; };
const low = (p: ShopProduct, a?: Answers) => (a ? quote(p, a) : priceRange(p)[0]);
const priceCell = (p: ShopProduct, a?: Answers) => { const u = unit(p); if (a) return L(`${money(quote(p, a))} ${u.en}`, `${money(quote(p, a))} ${u.zh}`); const [lo, hi] = priceRange(p); return L(`${money(lo)}–${hi.toLocaleString('en-US')} ${u.en}`, `${money(lo)}–${hi.toLocaleString('en-US')} ${u.zh}`); };
const argmin = (xs: number[]) => xs.indexOf(Math.min(...xs));
const argmax = (xs: number[]) => xs.indexOf(Math.max(...xs));

export interface CompareRow { label: L; cells: L[]; best?: number }

export function compareRows(dim: Dimension, ps: ShopProduct[], a?: Answers): CompareRow[] {
  const cat = CATEGORIES[ps[0].type];
  const price: CompareRow = { label: L('Price', '价格'), cells: ps.map((p) => priceCell(p, a)), best: argmin(ps.map((p) => low(p, a))) };
  const rating: CompareRow = { label: L('Rating', '评分'), cells: ps.map((p) => same(`★ ${p.rating.toFixed(1)}`)), best: argmax(ps.map((p) => p.rating)) };
  const claim: CompareRow = { label: L('Avg. days to pay a claim', '平均赔付天数'), cells: ps.map((p) => L(`${p.claimDays} days`, `${p.claimDays} 天`)), best: argmin(ps.map((p) => p.claimDays)) };
  const specs: CompareRow[] = cat.specLabels.map((label, k) => ({ label, cells: ps.map((p) => p.specs[k]) }));
  switch (dim) {
    case 'overall': return [price, rating, claim, ...specs];
    case 'coverage': return [...specs, { label: L('Highlight', '特色'), cells: ps.map((p) => p.tagline) }];
    case 'price': return [price, { label: L('Per year', '折合全年'), cells: ps.map((p) => same(money(yearly(p, a)))), best: argmin(ps.map((p) => yearly(p, a))) }, { label: L('Price basis', '价格依据'), cells: ps.map(() => (a ? L('Quoted for you', '按你的信息报价') : L('Estimated range', '估算区间'))) }];
    case 'claims': return [claim, rating, { label: L('Insurer hotline', '保险公司热线'), cells: ps.map((p) => same(insurerById(p.insurerId).hotline)) }];
    case 'fit': {
      const owned = POLICIES.filter((x) => x.type === ps[0].type);
      const rows: CompareRow[] = [];
      if (ps[0].type === 'medical') rows.push({ label: L('Within your ¥300 / month budget', '在你每月 ¥300 预算内'), cells: ps.map((p) => (low(p, a) <= 300 ? L('Yes', '是') : L('No', '否'))), best: argmin(ps.map((p) => low(p, a))) });
      rows.push({ label: L('Overlap with what you own', '与你现有保单的重叠'), cells: ps.map((p) => (owned.length ? (p.fills ? L('Adds to your plan, fills a gap', '可与现有保单互补，补上缺口') : L(`Overlaps with ${owned[0].product.en}`, `与「${owned[0].product.zh}」有重叠`)) : L('None, new cover for you', '无重叠，是你的新增保障'))) });
      rows.push({ label: L('Closes a known gap', '补上已知缺口'), cells: ps.map((p) => (p.fills === 'outpatient' ? L('Outpatient cover', '补上门诊保障') : owned.length ? L('No', '否') : L('Fills a missing category', '补上缺失的险种'))) });
      return rows;
    }
  }
}

const names = (ps: ShopProduct[]): L => L(ps.map((p) => p.name.en).join(' vs '), ps.map((p) => p.name.zh).join('、'));
const nm = (p: ShopProduct) => p.name;

export function analysis(dim: Dimension, ps: ShopProduct[], a?: Answers): { text: L; bullets: L[] } {
  const cheapest = ps[argmin(ps.map((p) => low(p, a)))];
  const fastest = ps[argmin(ps.map((p) => p.claimDays))];
  const rated = ps[argmax(ps.map((p) => p.rating))];
  const estimate = a ? [] : [L('Prices are estimated ranges until you fill in the quote form; fill it in for exact prices.', '填写报价问卷前，价格为估算区间；填写后可看到准确价格。')];
  const caution = L('This is a comparison to help you decide, not advice to buy. The insurer confirms the final price and terms.', '这是帮助你决策的对比，并非购买建议；最终价格和条款以保险公司为准。');
  switch (dim) {
    case 'coverage': {
      const cat = CATEGORIES[ps[0].type];
      return {
        text: L(`Here is how the cover differs for ${names(ps).en}.`, `${names(ps).zh} 的保障差异如下。`),
        bullets: [...ps.map((p) => L(`${p.name.en}: ${cat.specLabels.map((l, k) => `${l.en} ${p.specs[k].en}`).join('; ')}`, `${p.name.zh}：${cat.specLabels.map((l, k) => `${l.zh} ${p.specs[k].zh}`).join('；')}`)), caution],
      };
    }
    case 'price': {
      const gap = Math.max(...ps.map((p) => yearly(p, a))) - Math.min(...ps.map((p) => yearly(p, a)));
      return {
        text: L(`${nm(cheapest).en} is the cheapest of the ${ps.length}. The gap to the dearest is about ${money(gap)} a year.`, `${ps.length} 款中 ${nm(cheapest).zh} 最便宜，与最贵的相差约每年 ${money(gap)}。`),
        bullets: [L('The cheapest plan is not always the best fit: check the deductible and limits under coverage too.', '最便宜的不一定最合适，请同时看保障范围里的免赔额和限额。'), ...estimate, caution],
      };
    }
    case 'claims':
      return {
        text: fastest === rated
          ? L(`${nm(fastest).en} leads on claims: fastest payout (about ${fastest.claimDays} days) and the highest rating (${rated.rating.toFixed(1)}).`, `${nm(fastest).zh} 在理赔上领先：赔付最快（约 ${fastest.claimDays} 天），评分也最高（${rated.rating.toFixed(1)}）。`)
          : L(`${nm(fastest).en} pays claims fastest (about ${fastest.claimDays} days). ${nm(rated).en} has the highest rating at ${rated.rating.toFixed(1)}.`, `${nm(fastest).zh} 赔付最快（约 ${fastest.claimDays} 天），${nm(rated).zh} 评分最高（${rated.rating.toFixed(1)}）。`),
        bullets: [...ps.map((p) => L(`${p.name.en}: ${p.claimDays} days on average, rated ${p.rating.toFixed(1)}`, `${p.name.zh}：平均 ${p.claimDays} 天赔付，评分 ${p.rating.toFixed(1)}`)), caution],
      };
    case 'fit': {
      const owned = POLICIES.filter((x) => x.type === ps[0].type);
      const filler = ps.find((p) => p.fills);
      return {
        text: owned.length
          ? L(`You already hold ${owned[0].product.en}, so a new plan should add something rather than repeat it.`, `你已持有「${owned[0].product.zh}」，新增的产品最好是补充而不是重复。`)
          : L('You have no cover in this category yet, so any of these adds protection you do not have today.', '你目前没有这类保障，其中任何一款都能补上空缺。'),
        bullets: [...(filler ? [L(`${filler.name.en} is the one that fills the gap in your current plan.`, `${filler.name.zh} 能补上你现有保单的缺口。`)] : []), ps[0].type === 'medical' ? L('Your note says about ¥300 a month for hospital cover, so check the budget row.', '你的资料里医疗预算约每月 ¥300，请看预算那一行。') : L('Your profile notes a young child, which makes this category worth a closer look.', '你的资料里有年幼的孩子，这类保障值得重点考虑。'), ...estimate, caution],
      };
    }
    default: {
      const score = (p: ShopProduct) => p.rating * 10 + (10 - p.claimDays) - low(p, a) / Math.max(...ps.map((x) => low(x, a))) * 8;
      const best = ps[argmax(ps.map(score))];
      return {
        text: cheapest === best && fastest === best
          ? L(`Overall, ${nm(best).en} comes out ahead of ${names(ps).en}: lowest price, fastest claims and a top rating. Check the coverage rows before deciding, since others may cover more.`, `综合来看，${names(ps).zh} 中 ${nm(best).zh} 领先：价格最低、理赔最快、评分也高。决定前请再看保障范围，其他产品可能保障更多。`)
          : L(`Overall, ${nm(best).en} looks the most balanced of ${names(ps).en}. ${nm(cheapest).en} is cheapest and ${nm(fastest).en} pays claims fastest.`, `综合来看，${names(ps).zh} 中 ${nm(best).zh} 最均衡；${nm(cheapest).zh} 最便宜，${nm(fastest).zh} 赔付最快。`),
        bullets: [...ps.map((p) => L(`${p.name.en}: ${p.tagline.en}`, `${p.name.zh}：${p.tagline.zh}`)), ...estimate, caution],
      };
    }
  }
}
