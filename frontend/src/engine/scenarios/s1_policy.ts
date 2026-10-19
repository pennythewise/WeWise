import { L } from '../l';
import { SAMPLE_POLICY_FIELDS } from '@/mock/fixtures';
import { at, chip, cid, done, step, tool, understand, type TurnScript } from '../script';

export const s1Upload: TurnScript = {
  id: 's1.upload',
  utterances: [L('Use sample policy', '使用示例保单')],
  keywords: ['sample policy', 'upload my policy', 'upload a policy', 'add a policy', '示例保单', '上传保单', '上传一份保单'],
  events: (ctx) => [
    understand(ctx, 'ingest_policy', { file: 'sample_policy_harbour.pdf' }),
    at(300, { type: 'plan.created', steps: [step('read', L('Reading the document', '读取文件')), step('find', L('Finding clauses', '查找条款')), step('check', L('Checking the fields', '核对字段')), step('ready', L('Ready for your review', '等待您确认'))] }),
    at(350, { type: 'plan.step.started', stepId: 'read' }),
    ...tool(400, 'ocr_extract', 'T1', { file_id: 'file_sample_policy', pages: '1-16' }, L('16 pages read', '已读取 16 页'), 700),
    at(1150, { type: 'plan.step.done', stepId: 'read' }),
    at(1180, { type: 'guard.pii_masked', fields: [L('name', '姓名'), L('policy number', '保单号'), L('phone', '电话')], why: L('Personal details are masked before any language model sees the text.', '个人信息在语言模型读取文本之前已被脱敏。') }),
    at(1220, { type: 'plan.step.started', stepId: 'find' }),
    ...tool(1260, 'clause_index', 'T1', { file_id: 'file_sample_policy' }, L('Indexed 22 clauses with page numbers', '已为 22 条条款建立带页码的索引'), 800),
    at(2100, { type: 'plan.step.done', stepId: 'find' }),
    at(2130, { type: 'plan.step.started', stepId: 'check' }),
    ...tool(2170, 'field_confidence', 'T0', { fields: 10 }, L('1 field below 0.75: annual limit', '1 个字段低于 0.75：年度限额'), 350),
    at(2600, { type: 'plan.step.done', stepId: 'check' }),
    at(2630, { type: 'plan.step.started', stepId: 'ready' }),
    at(2700, { type: 'ui.card', card: { kind: 'ExtractionReviewCard', id: cid('extract'), data: { policyId: 'pol_mei_health_01', fields: SAMPLE_POLICY_FIELDS } } }),
    at(2850, { type: 'plan.step.done', stepId: 'ready' }),
    at(2900, {
      type: 'message.final',
      text: L('I read your policy. Most fields look right, but I wasn\'t sure about the annual limit (62% confident). Please check it, then confirm.', '我已读完您的保单，大部分字段没问题，但对年度限额不太确定（置信度 62%），请核对后确认。'),
      chips: [chip(L('Confirm all fields', '确认全部字段'), L('Confirm all fields', '确认全部字段'))],
    }),
    done(2950),
  ],
};

export const s1Confirm: TurnScript = {
  id: 's1.confirm',
  utterances: [L('Confirm all fields', '确认全部字段')],
  keywords: ['confirm all', 'confirmed all', 'i corrected', 'all fields confirmed', '确认全部', '已确认全部', '我已更正'],
  events: (ctx) => {
    const corrected = /annual limit|年度限额/i.test(ctx.text);
    return [
      understand(ctx, 'confirm_extraction', { corrected: corrected ? 'annual_limit' : 'none' }),
      at(250, { type: 'plan.created', steps: [step('save', L('Save your confirmed fields', '保存已确认字段')), step('reindex', L('Use them in future answers', '用于之后的回答'))] }),
      at(300, { type: 'plan.step.started', stepId: 'save' }),
      ...tool(350, 'policy_fields_save', 'T2', { policy_id: 'pol_mei_health_01', corrected: corrected ? ['annual_limit'] : [] }, L('Saved. Corrections apply to all later answers.', '已保存，更正将用于之后所有回答。'), 400),
      at(800, { type: 'plan.step.done', stepId: 'save' }),
      at(820, { type: 'plan.step.started', stepId: 'reindex' }),
      at(1000, { type: 'plan.step.done', stepId: 'reindex' }),
      at(1050, { type: 'verify.result', citationsOk: true, numbersOk: true, citations: ['HS-4.1'] }),
      at(1100, { type: 'ui.card', card: { kind: 'PolicySummaryCard', id: cid('summary'), data: { policyId: 'pol_mei_health_01' } } }),
      at(1250, {
        type: 'message.final',
        text: corrected
          ? L('Thanks. I updated the annual limit to ¥2,000,000 and I\'ll use it in every answer.', '谢谢。我已把年度限额更正为 ¥2,000,000，之后所有回答都会采用。')
          : L('All fields confirmed. I\'ll use them in every answer.', '全部字段已确认，之后所有回答都会采用。'),
        chips: [chip(L('Am I covered for dengue hospitalisation?', '登革热住院在保障范围内吗？'), L('Am I covered for dengue hospitalisation?', '登革热住院在保障范围内吗？')), chip(L('Check my gaps', '检查我的保障缺口'), L('Check my gaps', '检查我的保障缺口'))],
      }),
      done(1300),
    ];
  },
};

export const s1Coverage: TurnScript = {
  id: 's1.coverage',
  utterances: [L('Am I covered for dengue hospitalisation?', '登革热住院在保障范围内吗？')],
  keywords: ['dengue', 'am i covered', '登革热', '保障范围'],
  events: (ctx) => [
    understand(ctx, 'coverage_question', { condition: 'dengue fever', care: 'inpatient' }),
    at(250, { type: 'plan.created', steps: [step('find', L('Find the relevant clauses', '查找相关条款')), step('wait', L('Check the waiting period', '核对等待期')), step('share', L('Apply cost-sharing', '计算自付部分')), step('verify', L('Verify citations and numbers', '核验引用与数字'))] }),
    at(300, { type: 'plan.step.started', stepId: 'find' }),
    ...tool(340, 'clause_search', 'T0', { q: 'dengue inpatient', policy_id: 'pol_mei_health_01' }, L('3 clauses: HS-3.1, HS-3.4, HS-4.2', '3 条相关条款：HS-3.1、HS-3.4、HS-4.2'), 420),
    at(800, { type: 'plan.step.done', stepId: 'find' }),
    at(820, { type: 'plan.step.started', stepId: 'wait' }),
    ...tool(860, 'waiting_period_check', 'T0', { inception: '2025-11-25', days: 90, on: '2026-10-14' }, L('Served. 90 days ended on 2026-02-23', '已届满，90 天等待期于 2026-02-23 结束'), 260),
    at(1200, { type: 'plan.step.done', stepId: 'wait' }),
    at(1220, { type: 'plan.step.started', stepId: 'share' }),
    at(1500, { type: 'plan.step.done', stepId: 'share' }),
    at(1520, { type: 'plan.step.started', stepId: 'verify' }),
    at(1800, { type: 'verify.result', citationsOk: true, numbersOk: true, citations: ['HS-3.4', 'HS-4.2', 'HS-5.4', 'HS-5.1', 'HS-4.1'] }),
    at(1850, { type: 'plan.step.done', stepId: 'verify' }),
    at(1950, {
      type: 'message.final',
      verdict: 'covered',
      text: L('Yes. Dengue hospitalisation is covered under your Ping An e-Sheng Bao Medical, with cost-sharing.', '是的，登革热住院属于您平安e生保·百万医疗的保障范围，但需要承担部分费用。'),
      bullets: [
        L('Hospitalisation for infectious diseases such as dengue is covered like any other illness [[HS-3.4]].', '登革热等传染性疾病的住院与其他疾病同等条件赔付 [[HS-3.4]]。'),
        L('Your 90-day waiting period ended on 23 Feb 2026, so it no longer blocks a claim [[HS-4.2]].', '您的 90 天等待期已于 2026 年 2 月 23 日结束，不再影响理赔 [[HS-4.2]]。'),
        L('You pay the first ¥10,000 per admission, then 20% of the rest [[HS-5.4]].', '每次入院您先承担 ¥10,000，其余部分再承担 20% [[HS-5.4]]。'),
        L('Room and board is capped at ¥500 a day [[HS-5.1]].', '房费及膳食每日上限 ¥500 [[HS-5.1]]。'),
        L('All claims in a year are capped at ¥2,000,000 [[HS-4.1]].', '一年内所有赔付合计上限 ¥2,000,000 [[HS-4.1]]。'),
      ],
      citations: ['HS-3.4', 'HS-4.2', 'HS-5.4', 'HS-5.1', 'HS-4.1'],
      chips: [chip(L('I was admitted on 10 Oct', '我 10 月 10 日住院了'), L('I was admitted on 10 Oct', '我 10 月 10 日住院了')), chip(L('Check my gaps', '检查我的保障缺口'), L('Check my gaps', '检查我的保障缺口')), chip(L('Compare hospital plans', '比较住院保险'), L('Compare hospital plans for me', '帮我比较住院保险'))],
    }),
    done(2000),
  ],
};

export const s1Gaps: TurnScript = {
  id: 's1.gaps',
  utterances: [L('Check my gaps', '检查我的保障缺口')],
  keywords: ['gap', 'what am i missing', '缺口', '漏洞'],
  events: (ctx) => [
    understand(ctx, 'gap_check', { scope: 'portfolio' }),
    at(250, { type: 'plan.created', steps: [step('list', L('List your policies', '列出您的保单')), step('map', L('Map cover to six areas', '对照六类保障')), step('verify', L('Verify citations', '核验引用'))] }),
    at(300, { type: 'plan.step.started', stepId: 'list' }),
    ...tool(340, 'portfolio_get', 'T0', { user: 'usr_mei' }, L('5 policies', '共 5 份保单'), 250),
    at(650, { type: 'plan.step.done', stepId: 'list' }),
    at(670, { type: 'plan.step.started', stepId: 'map' }),
    ...tool(720, 'clause_search', 'T0', { q: 'outpatient|critical|dependant|overseas' }, L('5 areas matched, 2 with no clause found', '匹配 5 项，其中 2 项未找到条款'), 600),
    at(1350, { type: 'plan.step.done', stepId: 'map' }),
    at(1370, { type: 'plan.step.started', stepId: 'verify' }),
    at(1600, { type: 'verify.result', citationsOk: true, numbersOk: true, citations: ['HS-3.1', 'HS-9.1', 'PA-2.1', 'TR-3.1'] }),
    at(1650, { type: 'plan.step.done', stepId: 'verify' }),
    at(1700, {
      type: 'ui.card',
      card: {
        kind: 'GapReportCard', id: cid('gaps'),
        data: {
          rows: [
            { area: L('Hospitalisation', '住院'), status: 'covered', why: L('Covered up to ¥2,000,000 a year.', '每年最高赔付 ¥2,000,000。'), cite: 'HS-3.1' },
            { area: L('Outpatient', '门诊'), status: 'gap', why: L('Outpatient not linked to an admission is not covered.', '与住院无关的门诊不在保障范围内。'), cite: 'HS-9.1' },
            { area: L('Critical illness', '重大疾病'), status: 'gap', why: L('No clause found in any of your policies.', '您的所有保单中均未找到相关条款。') },
            { area: L('Personal accident', '个人意外'), status: 'covered', why: L('¥300,000 for accidental death or disability.', '意外身故或伤残赔付 ¥300,000。'), cite: 'PA-2.1' },
            { area: L('Overseas treatment', '海外治疗'), status: 'partial', why: L('Covered only for the Thailand trip, 20 Dec to 3 Jan.', '仅涵盖 12 月 20 日至 1 月 3 日的泰国行程。'), cite: 'TR-3.1' },
            { area: L('Dependants', '受抚养人'), status: 'gap', why: L('No clause found. Your child is not named on any policy.', '未找到相关条款，您的孩子未列入任何保单。') },
          ],
          considerations: [
            L('Outpatient visits are paid out of pocket today.', '目前门诊费用需自行承担。'),
            L('There is no critical illness cover.', '目前没有重大疾病保障。'),
            L('Your child has no cover of their own.', '您的孩子目前没有自己的保障。'),
          ],
        },
      },
    }),
    at(1850, {
      type: 'message.final',
      text: L('Here is how your cover lines up. Three areas have gaps. This is decision support, not a recommendation to buy.', '以下是您的保障概况，有三个领域存在缺口。这只是决策参考，并非购买建议。'),
      citations: ['HS-3.1', 'HS-9.1', 'PA-2.1', 'TR-3.1'],
      chips: [chip(L('Compare hospital plans', '比较住院保险'), L('Compare hospital plans for me', '帮我比较住院保险')), chip(L('Talk to a licensed agent', '联系持牌顾问'), L('Talk to a licensed agent', '联系持牌顾问'))],
    }),
    done(1900),
  ],
};
