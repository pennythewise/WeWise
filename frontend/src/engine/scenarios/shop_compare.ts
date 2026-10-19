import { L } from '../l';
import { at, chip, cid, done, step, tool, understand, type TurnScript } from '../script';
import { analysis, DIMENSIONS, dimensionMarker, parseDimension, parseProducts } from '@/mock/shopCompare';
import { useShopStore } from '@/features/shop/shopStore';
import { SHOP_PRODUCTS } from '@/mock/shop';

const nameList = (ids: string[]) => ids.map((id) => SHOP_PRODUCTS.find((p) => p.id === id)).filter((p) => !!p);

/** Step 1: product ids arrive as ctx.text; ask what the user wants to compare. */
export const shopCompareAsk: TurnScript = {
  id: 'shop.compare.ask',
  utterances: [],
  keywords: [],
  events: (ctx) => {
    const ps = nameList(ctx.text.split(','));
    const en = ps.map((p) => p!.name.en).join(' vs ');
    const zh = ps.map((p) => p!.name.zh).join('、');
    return [
      understand(ctx, 'compare_clarify', { products: ps.map((p) => p!.id).join(',') }),
      at(300, { type: 'message.final', text: L(`I see you picked ${en}. What would you like to compare: everything together, or one specific part such as coverage?`, `我看到你选了 ${zh}。想怎么对比：整体综合，还是某一方面，比如保障范围？`), chips: DIMENSIONS.map((d) => chip(d.chip, L(`Compare these plans ${dimensionMarker(d.key).en}: ${en}`, `请对比这些产品${dimensionMarker(d.key).zh}：${zh}`))) }),
      done(350),
    ];
  },
};

/** Step 2: the chip text carries the dimension and the product names. */
export const shopCompareResult: TurnScript = {
  id: 'shop.compare.result',
  utterances: [],
  keywords: ['compare these plans', '请对比这些产品'],
  events: (ctx) => {
    const ps = parseProducts(ctx.text);
    const dim = parseDimension(ctx.text);
    if (ps.length < 2) return [understand(ctx, 'compare_products'), at(300, { type: 'message.final', text: L('I could not tell which plans to compare. Pick them again from 选保险.', '我没能识别要对比的产品，请回到“选保险”重新选择。') }), done(350)];
    const answers = useShopStore.getState().quotes[ps[0].type];
    const { text, bullets } = analysis(dim, ps, answers);
    const others = DIMENSIONS.filter((d) => d.key !== dim).slice(0, 3);
    const en = ps.map((p) => p.name.en).join(' vs ');
    const zh = ps.map((p) => p.name.zh).join('、');
    return [
      understand(ctx, 'compare_products', { dimension: dim, products: ps.map((p) => p.id).join(',') }),
      at(250, { type: 'plan.created', steps: [step('load', L('Load plan details', '读取产品信息')), step('price', L('Work out prices', '计算价格')), step('own', L('Check against your policies', '对照你现有的保单')), step('write', L('Write the comparison', '撰写对比'))] }),
      at(300, { type: 'plan.step.started', stepId: 'load' }),
      ...tool(340, 'product_lookup', 'T0', { ids: ps.map((p) => p.id) }, L(`${ps.length} plans loaded`, `已读取 ${ps.length} 款产品`), 260),
      at(620, { type: 'plan.step.done', stepId: 'load' }),
      at(640, { type: 'plan.step.started', stepId: 'price' }),
      ...tool(680, 'quote_calc', 'T0', { ids: ps.map((p) => p.id), quoted: !!answers }, answers ? L('Priced with your answers', '已按你的信息计价') : L('No quote form yet, using estimated ranges', '尚未填写报价问卷，使用估算区间'), 280),
      at(980, { type: 'plan.step.done', stepId: 'price' }),
      at(1000, { type: 'plan.step.started', stepId: 'own' }),
      ...tool(1040, 'policy_overlap_check', 'T0', { type: ps[0].type }, L('Compared with your current policies', '已对照现有保单'), 240),
      at(1300, { type: 'plan.step.done', stepId: 'own' }),
      at(1320, { type: 'plan.step.started', stepId: 'write' }),
      at(1500, { type: 'ui.card', card: { kind: 'ShopCompareCard', id: cid('shopcmp'), data: { productIds: ps.map((p) => p.id), dimension: dim } } }),
      at(1700, { type: 'plan.step.done', stepId: 'write' }),
      at(1800, { type: 'message.final', text, bullets, chips: others.map((d) => chip(L(`Now: ${d.chip.en}`, `再看：${d.chip.zh}`), L(`Compare these plans ${dimensionMarker(d.key).en}: ${en}`, `请对比这些产品${dimensionMarker(d.key).zh}：${zh}`))) }),
      done(1850),
    ];
  },
};
