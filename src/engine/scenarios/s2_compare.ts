import { L } from '../l';
import { at, chip, cid, done, step, tool, understand, type TurnScript } from '../script';

export const s2Needs: TurnScript = {
  id: 's2.needs',
  utterances: [L('I want hospital cover, around 300 a month, I have a young kid', '我想买住院保障，每月预算约 300，家里有个小孩')],
  keywords: ['hospital cover', 'compare hospital', 'compare plans', 'young kid', 'a month', '比较住院', '比较保险', '小孩', '每月预算'],
  events: (ctx) => [
    understand(ctx, 'needs_capture', { goal: 'hospital cover', budget: '~¥300 / month', dependants: '1 child' }),
    at(250, { type: 'plan.created', steps: [step('mem', L('Check what I already know', '查看已掌握的信息')), step('gap', L('Find what is still missing', '找出缺少的信息'))] }),
    at(300, { type: 'plan.step.started', stepId: 'mem' }),
    ...tool(340, 'memory_read', 'T0', { keys: ['budget', 'dependants', 'trip'] }, L('Found budget and a young child. Not asking again.', '已有预算和年幼孩子的信息，不再重复询问。'), 220),
    at(600, { type: 'plan.step.done', stepId: 'mem' }),
    at(620, { type: 'plan.step.started', stepId: 'gap' }),
    at(900, { type: 'plan.step.done', stepId: 'gap' }),
    at(1000, {
      type: 'message.final',
      text: L('Got it: hospital cover, about ¥300 a month, one young child. I already had that from your profile. One quick question: would you want a standard ward or a private room?', '明白了：住院保障，每月约 ¥300，家里有一个年幼的孩子，这些我已从您的资料中了解。还想确认一件事：您需要普通病房还是单人病房？'),
      chips: [chip(L('Standard ward is fine', '普通病房就可以'), L('Standard ward is fine', '普通病房就可以')), chip(L('Private room', '单人病房'), L('Private room please', '请选单人病房'))],
    }),
    done(1050),
  ],
};

const A = 'prod_hs_a', B = 'prod_hs_b';
export const s2Compare: TurnScript = {
  id: 's2.compare',
  utterances: [L('Standard ward is fine', '普通病房就可以'), L('Private room please', '请选单人病房')],
  keywords: ['standard ward', 'private room', 'ward is fine', '普通病房', '单人病房'],
  events: (ctx) => [
    understand(ctx, 'compare_products', { room: /private|单人/i.test(ctx.text) ? 'private' : 'ward', budget: '~¥300', bill_example: '¥200,000' }),
    at(250, { type: 'plan.created', parallel: true, steps: [step('search', L('Shortlist products', '筛选候选产品')), step('advA', L('Advocate A: argue for Banyan Care Lite', '正方 A：为榕树轻享医疗辩护')), step('advB', L('Advocate B: argue for Orchid MediPlus', '正方 B：为兰花医保加强版辩护')), step('judge', L('Judge: weigh both', '评审：权衡两方')), step('verify', L('Verify numbers', '核验数字'))] }),
    at(300, { type: 'plan.step.started', stepId: 'search' }),
    ...tool(340, 'product_search', 'T0', { type: 'medical', max_premium: 320 }, L('4 candidates, shortlisted 2', '4 个候选，入围 2 个'), 450),
    at(850, { type: 'plan.step.done', stepId: 'search' }),
    at(880, { type: 'ui.card', card: { kind: 'CompareTableCard', id: cid('compare'), data: { productIds: [A, B], winners: { premium: A, deductible: B, coPay: B, limit: B, waiting: B, hike: B } } } }),
    at(900, { type: 'plan.step.started', stepId: 'advA' }),
    at(900, { type: 'plan.step.started', stepId: 'advB' }),
    ...tool(940, 'cost_estimator', 'T0', { product: A, bill: 200000 }, L('Product A: you pay ¥67,000', '产品 A：您需承担 ¥67,000'), 300),
    ...tool(960, 'cost_estimator', 'T0', { product: B, bill: 200000 }, L('Product B: you pay ¥24,500', '产品 B：您需承担 ¥24,500'), 300),
    at(1500, { type: 'ui.card', card: { kind: 'AdvocateCard', id: cid('advA'), data: { side: 'A', productId: A, argument: L('Lowest premium today at ¥228 a month, comfortably inside your budget. If you stay healthy, you save about ¥800 a year versus B.', '当前保费最低，每月 ¥228，完全在预算之内。如果您一直健康，每年比 B 省约 ¥800。') } } }),
    at(1700, { type: 'ui.card', card: { kind: 'AdvocateCard', id: cid('advB'), data: { side: 'B', productId: B, argument: L('A big admission costs you far less: lower deductible, 10% co-pay, and a higher limit. Premium rises are capped, which matters with a child.', '大额住院时您的负担小得多：自付额更低、共付仅 10%、限额更高，且保费涨幅有上限，家里有孩子时这点很重要。') } } }),
    at(1850, { type: 'plan.step.done', stepId: 'advA' }),
    at(1850, { type: 'plan.step.done', stepId: 'advB' }),
    at(1880, { type: 'plan.step.started', stepId: 'judge' }),
    at(2500, { type: 'plan.step.done', stepId: 'judge' }),
    at(2520, { type: 'plan.step.started', stepId: 'verify' }),
    at(2700, { type: 'verify.result', citationsOk: true, numbersOk: true }),
    at(2750, { type: 'plan.step.done', stepId: 'verify' }),
    at(2800, {
      type: 'ui.card',
      card: {
        kind: 'VerdictCard', id: cid('verdict'),
        data: {
          a: A, b: B,
          headline: L('The cheapest plan is not the best fit for you', '最便宜的方案并不是最适合您的'),
          criteria: [
            { name: L('Coverage fit', '保障匹配度'), a: 55, b: 85 },
            { name: L('Exclusion risk', '免责风险'), a: 60, b: 80 },
            { name: L('Waiting periods', '等待期'), a: 55, b: 75 },
            { name: L('Premium trajectory', '保费走势'), a: 40, b: 80 },
            { name: L('Claim friction', '理赔难度'), a: 55, b: 80 },
            { name: L('Expected out-of-pocket', '预期自付'), a: 35, b: 85 },
          ],
          winsA: L('You rarely claim, you want the lowest premium now, and you can absorb a large bill.', '您很少理赔、想要当下最低保费，并且能承受一笔大额账单。'),
          winsB: L('You want a smaller bill if someone is admitted, and predictable premiums while your child is young.', '您希望有人住院时自付更少，并希望孩子年幼期间保费可预测。'),
          cautions: [
            L('B costs ¥68 more per month, about ¥816 a year.', 'B 每月多 ¥68，每年约多 ¥816。'),
            L('Both exclude pre-existing conditions.', '两者都不保既往病症。'),
          ],
        },
      },
    }),
    at(2900, {
      type: 'message.final',
      text: L('Banyan Care Lite is cheaper each month, but for a ¥200,000 admission you would pay about ¥42,500 more than with Orchid MediPlus. Try the slider to test your own bill. For a final decision, a licensed agent can help.', '榕树轻享医疗每月更便宜，但如果住院花费 ¥200,000，您自付的金额会比兰花医保加强版多约 ¥42,500。可拖动滑块测试不同账单。最终决定可咨询持牌顾问。'),
      chips: [chip(L('Talk to a licensed agent', '联系持牌顾问'), L('Talk to a licensed agent', '联系持牌顾问'))],
    }),
    done(2950),
  ],
};

export const handoffPreview: TurnScript = {
  id: 'handoff.preview',
  utterances: [L('Talk to a licensed agent', '联系持牌顾问'), L('I\'d like to talk to a licensed agent', '我想联系持牌顾问')],
  keywords: ['licensed agent', 'human agent', 'talk to an agent', 'speak to', 'real person', '持牌', '真人', '顾问'],
  events: (ctx) => [
    understand(ctx, 'human_handoff', { language: ctx.lang, topic: 'hospital cover' }),
    at(250, { type: 'plan.created', steps: [step('match', L('Match a licensed agent', '匹配持牌顾问')), step('mask', L('Prepare a masked summary', '准备脱敏摘要')), step('consent', L('Ask for your consent', '征求您的同意'))] }),
    at(300, { type: 'plan.step.started', stepId: 'match' }),
    ...tool(340, 'agent_match', 'T1', { language: ['en', 'zh'], city: 'Shenzhen', topic: 'medical' }, L('6 agents, 3 speak your languages. Ranked by rating, reply time and load.', '共 6 位顾问，3 位通晓您的语言，按评分、回复时间与负载排序。'), 380),
    at(800, { type: 'plan.step.done', stepId: 'match' }),
    at(820, { type: 'plan.step.started', stepId: 'mask' }),
    at(900, { type: 'guard.pii_masked', fields: [L('name', '姓名'), L('phone', '电话'), L('ID number', '证件号')], why: L('Only masked values are shown to you and shared with the agent.', '展示给您及分享给顾问的均为脱敏数据。') }),
    at(1100, { type: 'plan.step.done', stepId: 'mask' }),
    at(1120, { type: 'plan.step.started', stepId: 'consent' }),
    at(1200, { type: 'guard.confirm_required', actionId: 'act_handoff', what: L('Share a masked summary with Daniel Chen', '向陈大伟顾问分享脱敏摘要'), why: L('Sharing your data with a person needs your explicit consent.', '向真人分享您的数据需要您的明确同意。') }),
    at(1300, {
      type: 'ui.card',
      card: {
        kind: 'HandoffPreviewCard', id: cid('handoff'),
        data: {
          actionId: 'act_handoff', agentIds: ['ag_chen', 'ag_wong', 'ag_lim'],
          why: {
            ag_chen: [L('Speaks English and 中文', '通晓英文和中文'), L('Rating 4.8', '评分 4.8'), L('Replies in about 15 min', '约 15 分钟内回复'), L('Near you in Shenzhen', '在您所在的深圳')],
            ag_wong: [L('Speaks English and 中文', '通晓英文和中文'), L('Rating 4.6', '评分 4.6'), L('Replies in about 20 min', '约 20 分钟内回复'), L('Based in Hangzhou', '位于杭州')],
            ag_lim: [L('Speaks English and 中文', '通晓英文和中文'), L('Rating 4.9', '评分 4.9'), L('Replies in about 40 min', '约 40 分钟内回复'), L('Busier right now', '目前较忙')],
          },
          shares: [
            { id: 'sh_name', label: L('Name', '姓名'), value: 'M** L** T**' },
            { id: 'sh_contact', label: L('Phone', '电话'), value: '+86 138****5082' },
            { id: 'sh_needs', label: L('Needs summary', '需求摘要'), value: L('Hospital cover · ~¥300/mo · 1 child', '住院保障 · 约 ¥300/月 · 1 个孩子') },
            { id: 'sh_compare', label: L('Comparison result', '比较结果'), value: L('Banyan Care Lite vs Orchid MediPlus', '榕树轻享医疗 对比 兰花医保加强版') },
          ],
        },
      },
    }),
    at(1450, { type: 'message.final', text: L('Here is exactly what I would share. Nothing is sent until you confirm.', '以下是我将分享的全部内容，在您确认之前不会发送任何信息。') }),
    done(1500),
  ],
};
