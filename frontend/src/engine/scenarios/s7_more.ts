import { L } from '../l';
import { at, chip, cid, done, step, tool, understand, type TurnScript } from '../script';
import { PARTIES, type PartyKind } from '@/mock/local';
import { cityById, suggestionsFor } from '@/mock/cities';

// ── Report analysis (B1: analyse medical / financial reports) ──

export const s7Medical: TurnScript = {
  id: 's7.medical',
  utterances: [L('Analyse my health screening report', '分析我的体检报告')],
  keywords: ['health screening', 'medical report', 'blood test', 'check-up report', '体检报告', '体检', '化验'],
  events: (ctx) => [
    understand(ctx, 'analyse_report', { kind: 'medical', file: 'health_screening_sep2026.pdf' }),
    at(250, { type: 'plan.created', steps: [step('read', L('Read the report', '读取报告')), step('mask', L('Mask personal details', '个人信息脱敏')), step('map', L('Match findings to your policies', '对照您的保单')), step('verify', L('Verify citations', '核验引用'))] }),
    at(300, { type: 'plan.step.started', stepId: 'read' }),
    ...tool(340, 'ocr_extract', 'T1', { file_id: 'file_health_screening', pages: '1-6' }, L('6 pages read, 14 results found', '已读取 6 页，识别 14 项结果'), 650),
    at(1020, { type: 'plan.step.done', stepId: 'read' }),
    at(1040, { type: 'plan.step.started', stepId: 'mask' }),
    at(1080, { type: 'guard.pii_masked', fields: [L('name', '姓名'), L('ID number', '证件号'), L('patient number', '病历号')], why: L('Health data is sensitive. Identifiers are removed before analysis, and nothing is shared without your consent.', '健康数据属于敏感信息，分析前已去除身份标识，未经您同意不会分享。') }),
    at(1200, { type: 'plan.step.done', stepId: 'mask' }),
    at(1220, { type: 'plan.step.started', stepId: 'map' }),
    ...tool(1260, 'clause_search', 'T0', { q: 'pre-existing|disclosure', policies: 'all' }, L('HS-6.2 pre-existing conditions, TR-8.1 travel', 'HS-6.2 既往病症，TR-8.1 旅行险'), 420),
    at(1720, { type: 'plan.step.done', stepId: 'map' }),
    at(1740, { type: 'plan.step.started', stepId: 'verify' }),
    at(1950, { type: 'verify.result', citationsOk: true, numbersOk: true, citations: ['HS-6.2', 'TR-8.1'] }),
    at(2000, { type: 'plan.step.done', stepId: 'verify' }),
    at(2050, {
      type: 'ui.card',
      card: {
        kind: 'ReportInsightsCard', id: cid('report'),
        data: {
          report: 'medical', file: 'health_screening_sep2026.pdf',
          findings: [
            { label: L('Blood pressure', '血压'), value: '142 / 92 mmHg', status: 'disclose', note: L('Above the normal range. Declare it on new applications.', '高于正常范围，新投保时需如实告知。'), page: 2 },
            { label: L('LDL cholesterol', '低密度脂蛋白胆固醇'), value: '4.2 mmol/L', status: 'watch', note: L('Slightly high. Usually no effect on cover.', '略高，通常不影响承保。'), page: 3 },
            { label: L('Liver ultrasound', '肝脏 B 超'), value: L('Mild fatty liver', '轻度脂肪肝'), status: 'disclose', note: L('Insurers often ask about this.', '保险公司通常会询问此项。'), page: 5 },
            { label: L('Fasting glucose', '空腹血糖'), value: '5.4 mmol/L', status: 'ok', page: 3 },
            { label: L('BMI', '体重指数'), value: '24.1', status: 'ok', page: 1 },
          ],
          implications: [
            L('Your Ping An e-Sheng Bao Medical started on 25 Nov 2025, before this screening, so these findings are not pre-existing for that plan [[HS-6.2]].', '您的平安e生保·百万医疗于 2025 年 11 月 25 日生效，早于本次体检，因此这些结果对该计划不属于既往病症 [[HS-6.2]]。'),
            L('Keep that plan in force. If you cancel it and buy a new one, high blood pressure and fatty liver could become exclusions.', '请保持该计划有效。如果退保后重新投保，高血压和脂肪肝可能会成为除外责任。'),
            L('For any new plan (for example critical illness), declare both findings. Not declaring them can lead to a refused claim.', '投保任何新计划（例如重疾险）时，请如实告知这两项结果，否则可能导致拒赔。'),
            L('For your Thailand trip, travel cover excludes pre-existing conditions unless declared [[TR-8.1]].', '前往泰国旅行时，旅行险不保未申报的既往病症 [[TR-8.1]]。'),
          ],
          memory: [L('Health screening, Sep 2026: high blood pressure and mild fatty liver. Declare on new applications.', '2026 年 9 月体检：血压偏高、轻度脂肪肝，新投保时需告知。')],
        },
      },
    }),
    at(2200, {
      type: 'message.final',
      text: L('I read your health screening. Two results should be declared if you apply for new cover. Your current hospital plan is not affected. I\'m not a doctor, so please discuss the results themselves with one.', '我已阅读您的体检报告。如果申请新保障，有两项结果需要如实告知；您现有的住院计划不受影响。我不是医生，结果本身请咨询医生。'),
      citations: ['HS-6.2', 'TR-8.1'],
      chips: [chip(L('Check my gaps', '检查我的保障缺口'), L('Check my gaps', '检查我的保障缺口')), chip(L('Talk to a licensed agent', '联系持牌顾问'), L('Talk to a licensed agent', '联系持牌顾问'))],
    }),
    done(2250),
  ],
};

export const s7Finance: TurnScript = {
  id: 's7.finance',
  utterances: [L('Analyse my payslip and bank statement', '分析我的工资单和银行流水')],
  keywords: ['payslip', 'bank statement', 'financial report', 'my income', 'afford', '工资单', '银行流水', '收入', '负担得起'],
  events: (ctx) => [
    understand(ctx, 'analyse_report', { kind: 'financial', file: 'payslip_and_bank_statement_sep.pdf' }),
    at(250, { type: 'plan.created', steps: [step('read', L('Read the documents', '读取文件')), step('mask', L('Mask account details', '账户信息脱敏')), step('calc', L('Work out income and spending', '计算收入和支出')), step('verify', L('Check the numbers', '核对数字'))] }),
    at(300, { type: 'plan.step.started', stepId: 'read' }),
    ...tool(340, 'ocr_extract', 'T1', { file_id: 'file_payslip_statement', pages: '1-4' }, L('4 pages, 63 transactions', '4 页，63 笔交易'), 600),
    at(980, { type: 'plan.step.done', stepId: 'read' }),
    at(1000, { type: 'plan.step.started', stepId: 'mask' }),
    at(1040, { type: 'guard.pii_masked', fields: [L('name', '姓名'), L('account number', '账号'), L('employer', '雇主')], why: L('Account numbers are masked and the statement is not stored after analysis.', '账号已脱敏，分析完成后不保存流水原件。') }),
    at(1150, { type: 'plan.step.done', stepId: 'mask' }),
    at(1170, { type: 'plan.step.started', stepId: 'calc' }),
    ...tool(1200, 'budget_calc', 'T0', { take_home: 18600, fixed: 9800, premiums: 800, savings: 42000 }, L('Premiums 4.3% of take-home pay', '保费占到手收入 4.3%'), 300),
    at(1550, { type: 'plan.step.done', stepId: 'calc' }),
    at(1570, { type: 'plan.step.started', stepId: 'verify' }),
    at(1750, { type: 'verify.result', citationsOk: true, numbersOk: true }),
    at(1800, { type: 'plan.step.done', stepId: 'verify' }),
    at(1850, {
      type: 'ui.card',
      card: {
        kind: 'ReportInsightsCard', id: cid('report'),
        data: {
          report: 'financial', file: 'payslip_and_bank_statement_sep.pdf',
          findings: [
            { label: L('Take-home pay', '到手收入'), value: L('¥18,600 / month', '每月 ¥18,600'), status: 'ok', page: 1 },
            { label: L('Fixed costs (rent, childcare, loans)', '固定支出（房租、托育、贷款）'), value: L('¥9,800 / month', '每月 ¥9,800'), status: 'ok', page: 2 },
            { label: L('Insurance premiums now', '目前保费'), value: L('¥800 / month (4.3%)', '每月 ¥800（4.3%）'), status: 'ok', page: 3 },
            { label: L('Emergency savings', '应急储蓄'), value: L('¥42,000 (about 4 months of fixed costs)', '¥42,000（约 4 个月固定支出）'), status: 'watch', note: L('If you couldn\'t work, this lasts about 4 months.', '如果无法工作，约可支撑 4 个月。'), page: 4 },
          ],
          implications: [
            L('A common rule of thumb is to keep all premiums under about 10% of take-home pay. For you that is about ¥1,860 a month, so there is room of about ¥1,060.', '常见的参考做法是总保费不超过到手收入的约 10%。对您来说约每月 ¥1,860，还有约 ¥1,060 的空间。'),
            L('Your ¥300 budget for more hospital cover fits. Total premiums would be about ¥1,100, or 5.9% of take-home pay.', '您为住院保障预留的 ¥300 预算是可行的，总保费约 ¥1,100，占到手收入 5.9%。'),
            L('You have no cover that replaces income if you can\'t work. Critical illness or income protection is worth comparing.', '您目前没有在无法工作时替代收入的保障，重疾险或收入保障值得比较。'),
            L('This is decision support, not financial advice.', '以上为决策参考，并非理财建议。'),
          ],
          memory: [L('Take-home pay about ¥18,600 a month; premiums are 4.3% of it', '到手收入约每月 ¥18,600，保费占 4.3%'), L('Emergency savings cover about 4 months', '应急储蓄约可支撑 4 个月')],
        },
      },
    }),
    at(2000, {
      type: 'message.final',
      text: L('Here is what your payslip and statement say about what you can afford. Your account numbers were masked and the documents are not kept.', '以下是根据您的工资单和流水得出的可负担情况。账号已脱敏，文件不会保留。'),
      chips: [chip(L('Compare hospital plans', '比较住院保险'), L('Compare hospital plans for me', '帮我比较住院保险')), chip(L('Check my gaps', '检查我的保障缺口'), L('Check my gaps', '检查我的保障缺口'))],
    }),
    done(2050),
  ],
};

// ── Cross-policy overlap and gaps (D2), incl. gig workers ──

const GIG = ['gig', 'delivery', 'deliver', 'rider', 'ride-hailing', 'grab', 'didi', 'meituan', '外卖', '骑手', '跑单', '网约车', '配送'];
export const s7Overlap: TurnScript = {
  id: 's7.overlap',
  utterances: [L('Am I paying twice for anything?', '我有没有重复投保？'), L('I also do food delivery part-time. Am I covered?', '我还兼职送外卖，有保障吗？')],
  keywords: ['overlap', 'paying twice', 'double cover', 'duplicate', '重复', '重叠', ...GIG],
  events: (ctx) => {
    const gig = GIG.some((k) => ctx.text.toLowerCase().includes(k));
    return [
      understand(ctx, 'overlap_check', { scope: 'portfolio', gig: String(gig) }),
      at(250, { type: 'plan.created', steps: [step('list', L('List cover from every insurer', '列出各保险公司的保障')), step('match', L('Find overlaps and holes', '查找重叠和缺口')), step('verify', L('Verify citations', '核验引用'))] }),
      at(300, { type: 'plan.step.started', stepId: 'list' }),
      ...tool(340, 'portfolio_get', 'T0', { user: 'usr_mei' }, L('5 policies from 4 insurers', '4 家保险公司共 5 份保单'), 250),
      at(650, { type: 'plan.step.done', stepId: 'list' }),
      at(670, { type: 'plan.step.started', stepId: 'match' }),
      ...tool(700, 'overlap_matrix', 'T0', { areas: 9, gig }, gig ? L('2 overlaps, 3 gaps, 2 gig-work gaps', '2 处重叠，3 处缺口，2 处兼职工作缺口') : L('2 overlaps, 3 gaps', '2 处重叠，3 处缺口'), 500),
      at(1250, { type: 'plan.step.done', stepId: 'match' }),
      at(1270, { type: 'plan.step.started', stepId: 'verify' }),
      at(1450, { type: 'verify.result', citationsOk: true, numbersOk: true, citations: gig ? ['PA-5.4', 'MO-6.3', 'PA-2.4', 'HS-5.4'] : ['PA-2.4', 'HS-5.4', 'HS-9.1'] }),
      at(1500, { type: 'plan.step.done', stepId: 'verify' }),
      at(1550, { type: 'ui.card', card: { kind: 'OverlapReportCard', id: cid('overlap'), data: { gig } } }),
      at(1700, {
        type: 'message.final',
        text: gig
          ? L('Important: your personal accident plan excludes injuries during paid delivery work [[PA-5.4]], and your motor plan is for private use only [[MO-6.3]]. While delivering, you may rely only on the platform\'s cover.', '重要：您的个人意外险不保有偿配送期间的伤害 [[PA-5.4]]，车险仅限私人用途 [[MO-6.3]]。配送期间，您可能只能依靠平台提供的保障。')
          : L('You are not paying twice for the same thing. The overlap between your accident and hospital plans is useful, because the accident plan can pay your hospital deductible [[PA-2.4]] [[HS-5.4]].', '您没有为同一风险重复付费。意外险和住院险的重叠是有用的，意外险可以用来支付住院自付额 [[PA-2.4]] [[HS-5.4]]。'),
        citations: gig ? ['PA-5.4', 'MO-6.3'] : ['PA-2.4', 'HS-5.4'],
        chips: gig ? [chip(L('Talk to a licensed agent', '联系持牌顾问'), L('Talk to a licensed agent', '联系持牌顾问'))] : [chip(L('I also do food delivery part-time', '我还兼职送外卖'), L('I also do food delivery part-time. Am I covered?', '我还兼职送外卖，有保障吗？'))],
      }),
      done(1750),
    ];
  },
};

// ── Switching / surrender-and-rebuy red-flag check (B5) ──

export const s7Switch: TurnScript = {
  id: 's7.switch',
  utterances: [L('An agent told my dad to cancel his policy and buy a new one', '有人让我爸退掉旧保单换新的')],
  keywords: ['surrender', 'cancel my policy', 'cancel his policy', 'cancel her policy', 'switch policy', 'switch my policy', 'full refund', 'new policy instead', '退保', '换保单', '全额退', '代理退保', '退旧买新'],
  events: (ctx) => [
    understand(ctx, 'switch_check', { who: 'parent' }),
    at(250, { type: 'plan.created', steps: [step('loss', L('Work out the surrender loss', '计算退保损失')), step('flags', L('Check for mis-selling red flags', '检查误导销售信号')), step('cool', L('Check the cooling-off period', '核对犹豫期'))] }),
    at(300, { type: 'plan.step.started', stepId: 'loss' }),
    ...tool(340, 'surrender_calc', 'T0', { paid: 96000, surrender_value: 61500 }, L('Loss if surrendered now: ¥34,500', '现在退保损失：¥34,500'), 300),
    at(700, { type: 'plan.step.done', stepId: 'loss' }),
    at(720, { type: 'plan.step.started', stepId: 'flags' }),
    at(950, { type: 'plan.step.done', stepId: 'flags' }),
    at(970, { type: 'plan.step.started', stepId: 'cool' }),
    at(1150, { type: 'plan.step.done', stepId: 'cool' }),
    at(1200, { type: 'ui.card', card: { kind: 'SwitchCheckCard', id: cid('switch'), data: {} } }),
    at(1300, {
      type: 'message.final',
      text: L('Before anyone surrenders a policy, let\'s check what would be lost. Surrendering early usually means getting back much less than was paid, new waiting periods, and new health questions. Fill in the numbers below or open the full check.', '在退保之前，先看看会损失什么。提前退保通常意味着拿回的钱远少于已交保费、等待期重新计算，以及需要重新健康告知。请填写下方数字，或打开完整检查。'),
    }),
    done(1350),
  ],
};

// ── Connect the involved party (C6) ── played from the incident guide; ctx.text = party kind

export const partyConnect: TurnScript = {
  id: 'party.connect',
  utterances: [],
  keywords: ['__party_connect'],
  events: (ctx) => {
    const p = PARTIES[(ctx.text as PartyKind) || 'hospital'];
    return [
      understand(ctx, 'connect_party', { party: p.kind, country: 'TH' }, 'en'),
      at(250, { type: 'plan.created', steps: [step('case', L('Open a case with your insurer', '在保险公司开立案件')), step('invite', L('Send a secure invite in the local language', '以当地语言发送安全邀请'))] }),
      at(300, { type: 'plan.step.started', stepId: 'case' }),
      ...tool(340, 'assistance_case_open', 'T2', { insurer: 'sunrise', policy: 'pol_mei_travel_01', country: 'TH' }, L('Case TA-58213 opened', '已开立案件 TA-58213'), 400),
      at(780, { type: 'plan.step.done', stepId: 'case' }),
      at(800, { type: 'plan.step.started', stepId: 'invite' }),
      at(830, { type: 'guard.pii_masked', fields: [L('policy number', '保单号'), L('name', '姓名')], why: L('Only the items you ticked are shared, and they are masked.', '仅分享您勾选的内容，且已脱敏。') }),
      ...tool(880, 'party_invite', 'T3', { party: p.kind, lang: 'th', consent: true, expires_h: 72 }, L('Invite sent with your consent', '已在您同意后发送邀请'), 500),
      at(1420, { type: 'plan.step.done', stepId: 'invite' }),
      at(1440, { type: 'verify.result', citationsOk: true, numbersOk: true }),
      at(1470, { type: 'message.final', text: L(`I opened case TA-58213 and invited the ${p.name.en.split(' (')[0].toLowerCase()} to talk to your insurer directly. I'll show their replies here, translated.`, `我已开立案件 TA-58213，并邀请${p.name.zh.split('（')[0]}直接与您的保险公司沟通。对方回复会翻译后显示在这里。`) }),
      done(1500),
    ];
  },
};

// ── AI agents in the claim workflow (C, "replace repetitive manual work") ──

export const claimAgents: TurnScript = {
  id: 'claim.agents',
  utterances: [],
  keywords: ['__claim_agents'],
  events: (ctx) => [
    understand(ctx, 'claim_agents', { claim: 'clm_mei_001' }, 'en'),
    at(250, { type: 'plan.created', parallel: true, steps: [step('check', L('Consistency checker', '一致性检查')), step('bill', L('Bill checker', '账单检查')), step('form', L('Form filler', '表单填写')), step('chase', L('Document chaser', '材料催办'))] }),
    at(300, { type: 'plan.step.started', stepId: 'check' }),
    ...tool(320, 'consistency_check', 'T0', { docs: ['doc_discharge', 'doc_bill', 'doc_form'] }, ctx.text === 'issue' ? L('1 issue: discharge date before admission', '1 处问题：出院日期早于入院日期') : L('Names, dates and amounts match', '姓名、日期、金额一致'), 380),
    at(720, { type: 'plan.step.done', stepId: 'check', ok: ctx.text !== 'issue' }),
    at(330, { type: 'plan.step.started', stepId: 'bill' }),
    ...tool(350, 'bill_check', 'T0', { total: 18420, room_per_day: 500, deductible: 10000, copay: 0.2 }, L('Room within ¥500/day cap. Estimated payout ¥6,736', '房费未超每日 ¥500 上限，预计赔付 ¥6,736'), 420),
    at(800, { type: 'plan.step.done', stepId: 'bill' }),
    at(340, { type: 'plan.step.started', stepId: 'form' }),
    ...tool(360, 'claim_form_fill', 'T1', { from: ['doc_discharge', 'doc_bill'], fields: 6 }, L('6 fields filled for your review', '已填写 6 个字段，等待您确认'), 450),
    at(830, { type: 'plan.step.done', stepId: 'form' }),
    at(350, { type: 'plan.step.started', stepId: 'chase' }),
    ...tool(380, 'doc_request_draft', 'T1', { to: 'Shenzhen People\'s Hospital', doc: 'referral letter' }, L('Request drafted. Not needed to submit.', '已起草请求，非提交必需。'), 400),
    at(800, { type: 'plan.step.done', stepId: 'chase' }),
    at(900, { type: 'verify.result', citationsOk: true, numbersOk: true, citations: ['HS-5.1', 'HS-5.4'] }),
    at(950, {
      type: 'message.final',
      text: L('My agents prepared your claim: the form is filled, the bill is within your limits (estimated payout about ¥6,736) and a request for the optional referral letter is drafted. Please review each document. Nothing goes to the insurer until you confirm.', '我的助手已帮您准备理赔：表单已填写，账单未超限额（预计赔付约 ¥6,736），可选的转诊信请求也已起草。请逐项核对，在您确认之前不会向保险公司发送任何内容。'),
      citations: ['HS-5.1', 'HS-5.4'],
    }),
    done(1000),
  ],
};

export const claimFollowup: TurnScript = {
  id: 'claim.followup',
  utterances: [],
  keywords: ['__claim_followup'],
  events: (ctx) => [
    understand(ctx, 'claim_followup', { claim: ctx.text || 'clm_mei_001' }, 'en'),
    at(250, { type: 'plan.created', steps: [step('read', L('Read what the insurer asked for', '读取保险公司的要求')), step('get', L('Get the document', '获取材料')), step('draft', L('Draft your reply', '起草回复'))] }),
    at(300, { type: 'plan.step.started', stepId: 'read' }),
    ...tool(330, 'claim_status', 'T0', { claim: ctx.text || 'clm_mei_001' }, L('Insurer needs an itemised bill', '保险公司需要费用明细账单'), 250),
    at(620, { type: 'plan.step.done', stepId: 'read' }),
    at(640, { type: 'plan.step.started', stepId: 'get' }),
    ...tool(670, 'doc_fetch', 'T2', { source: 'e-receipt in your inbox', consent: true }, L('Itemised bill found: ¥1,240, 6 items', '已找到费用明细账单：¥1,240，6 项'), 520),
    at(1230, { type: 'plan.step.done', stepId: 'get' }),
    at(1250, { type: 'plan.step.started', stepId: 'draft' }),
    at(1500, { type: 'plan.step.done', stepId: 'draft' }),
    at(1510, { type: 'verify.result', citationsOk: true, numbersOk: true }),
    at(1520, { type: 'guard.confirm_required', actionId: 'act_followup_send', what: L('Send the itemised bill to the insurer', '向保险公司发送费用明细账单') }),
    at(1560, {
      type: 'ui.card',
      card: {
        kind: 'ConfirmActionCard', id: cid('confirm'),
        data: { actionId: 'act_followup_send', title: L('Send this reply?', '发送此回复？'), what: L('Reply to the insurer\'s request with the itemised bill', '用费用明细账单回复保险公司的要求'), to: L('Your insurer\'s claims team (official channel)', '您的保险公司理赔团队（官方渠道）'), shared: [L('Itemised bill (1 page)', '费用明细账单（1 页）'), L('Claim number', '理赔编号')], expiresInSec: 600 },
      },
    }),
    at(1650, { type: 'message.final', text: L('I found the itemised bill and drafted your reply. Check it and confirm to send.', '我已找到费用明细账单并起草了回复，请核对后确认发送。') }),
    done(1700),
  ],
};

// ── Location-based suggestions (new): ask permission first, then suggest ──

export const locationAsk: TurnScript = {
  id: 'location.ask',
  utterances: [L('Suggest insurance based on my location', '根据我的位置推荐保险')],
  keywords: ['my location', 'where i live', 'where i am', 'near me', 'my city', 'my area', 'local risk', '我的位置', '所在地', '我这里', '附近', '本地', '所在城市'],
  events: (ctx) => [
    understand(ctx, 'location_suggest', { needs: 'location_permission' }),
    at(250, { type: 'plan.created', steps: [step('perm', L('Ask for your permission', '征求您的同意'))] }),
    at(300, { type: 'plan.step.started', stepId: 'perm' }),
    at(330, { type: 'guard.confirm_required', actionId: 'act_location', what: L('Use your device location (city only)', '使用设备位置（仅城市）'), why: L('Location is personal data, so I ask before using it.', '位置属于个人数据，使用前需征得同意。') }),
    at(400, { type: 'ui.card', card: { kind: 'LocationPermissionCard', id: cid('loc'), data: {} } }),
    at(450, { type: 'plan.step.done', stepId: 'perm' }),
    at(500, { type: 'message.final', text: L('To suggest cover for where you are, I need your location. I only keep your city, and you can say no.', '为了推荐适合您所在地的保障，我需要您的位置。我只保留城市信息，您也可以拒绝。') }),
    done(550),
  ],
};

export const locationSuggest: TurnScript = {
  id: 'location.suggest',
  utterances: [],
  keywords: ['__location_suggest'],
  events: (ctx) => {
    const city = cityById(ctx.text || 'shenzhen');
    const list = suggestionsFor(city);
    const cites = list.map((s) => s.cite).filter((c): c is string => !!c);
    return [
      understand(ctx, 'location_suggest', { city: city.id, country: city.country }, 'en'),
      at(250, { type: 'plan.created', steps: [step('city', L('Find your city', '确定城市')), step('risk', L('Look up local risks', '查询当地风险')), step('match', L('Match against your policies', '对照您的保单')), step('verify', L('Verify citations', '核验引用'))] }),
      at(300, { type: 'plan.step.started', stepId: 'city' }),
      at(320, { type: 'guard.pii_masked', fields: [L('exact coordinates', '精确坐标')], why: L('Matched to the nearest city on your device; coordinates are not sent or stored.', '在设备上匹配到最近的城市，坐标不会被发送或保存。') }),
      ...tool(350, 'geo_city', 'T0', { precision: 'city' }, L(`City: ${city.name.en}`, `城市：${city.name.zh}`), 200),
      at(600, { type: 'plan.step.done', stepId: 'city' }),
      at(620, { type: 'plan.step.started', stepId: 'risk' }),
      ...tool(650, 'local_risk_profile', 'T0', { city: city.id }, L(`${city.risks.length} local risks`, `${city.risks.length} 项当地风险`), 380),
      at(1080, { type: 'plan.step.done', stepId: 'risk' }),
      at(1100, { type: 'plan.step.started', stepId: 'match' }),
      ...tool(1130, 'portfolio_get', 'T0', { user: 'usr_mei' }, L('5 policies from 4 insurers', '4 家保险公司共 5 份保单'), 220),
      ...tool(1380, 'clause_search', 'T0', { q: cites.join('|') }, L(`${list.length} suggestions, each tied to a clause`, `${list.length} 条建议，均对应条款`), 380),
      at(1800, { type: 'plan.step.done', stepId: 'match' }),
      at(1820, { type: 'plan.step.started', stepId: 'verify' }),
      at(2000, { type: 'verify.result', citationsOk: true, numbersOk: true, citations: cites }),
      at(2050, { type: 'plan.step.done', stepId: 'verify' }),
      at(2100, { type: 'ui.card', card: { kind: 'LocationSuggestCard', id: cid('locsug'), data: { cityId: city.id } } }),
      at(2250, {
        type: 'message.final',
        text: L(`Here is what matters in ${city.name.en}, ranked by risk and by what you already have. ${list.filter((s) => s.priority === 'high').length} need attention soon.`, `以下是${city.name.zh}需要关注的保障，按风险和现有保障排序，其中 ${list.filter((s) => s.priority === 'high').length} 项需要尽快处理。`),
        citations: cites,
        chips: [chip(L('Talk to a licensed agent', '联系持牌顾问'), L('Talk to a licensed agent', '联系持牌顾问')), chip(L('Am I paying twice?', '有没有重复投保？'), L('Am I paying twice for anything?', '我有没有重复投保？'))],
      }),
      done(2300),
    ];
  },
};
