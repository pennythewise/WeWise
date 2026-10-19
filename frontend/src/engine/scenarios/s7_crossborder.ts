import { L } from '../l';
import { at, chip, cid, done, step, tool, understand, type TurnScript } from '../script';
import { incidentFor } from '@/mock/incidents';

// S3 · Claim abroad. Mei is on her Thailand trip (policy period 20 Dec 2026 – 3 Jan 2027, so "today" in this story is 22 Dec)
// and is admitted with dengue in Phuket. Fictional hospital, bill and rate; the 0.20 baht rate is a fixed demo constant.
const POLICY = 'pol_mei_travel_01';
const BILL_THB = 210_000;
const RATE = 0.2; // demo rate, CNY per THB
const BILL_CNY = Math.round(BILL_THB * RATE);
const yuan = (n: number) => `¥${n.toLocaleString('en-US')}`;
const ask = (en: string, zh: string) => chip(L(en, zh), L(en, zh));

export const s7Cover: TurnScript = {
  id: 's7.cover',
  utterances: [L('I\'m in hospital in Phuket with dengue. Am I covered?', '我在普吉岛住院，得了登革热，保险赔吗？')],
  keywords: ['phuket', 'in hospital in thailand', '普吉', '在泰国住院'],
  events: (ctx) => [
    understand(ctx, 'coverage_question', { country: 'TH', condition: 'dengue', care: 'inpatient', policy: POLICY }),
    at(250, { type: 'plan.created', steps: [step('pol', L('Open your Thailand policy', '打开您的泰国保单')), step('cover', L('Check overseas medical cover', '核对海外医疗保障')), step('rule', L('Check the reporting deadline', '核对报案期限'))] }),
    at(300, { type: 'plan.step.started', stepId: 'pol' }),
    ...tool(340, 'policy_get', 'T0', { policy_id: POLICY }, L('CPIC Overseas Travel – Thailand, in force 20 Dec–3 Jan', '太保境外旅行险（泰国），20 日至 1 月 3 日有效'), 260),
    at(640, { type: 'plan.step.done', stepId: 'pol' }),
    at(660, { type: 'plan.step.started', stepId: 'cover' }),
    ...tool(700, 'clause_search', 'T0', { q: 'overseas medical emergency treatment', policy_id: POLICY }, L('TR-3.1: up to ¥500,000 during the trip', 'TR-3.1：旅程期间最高 ¥500,000'), 300),
    at(1030, { type: 'plan.step.done', stepId: 'cover' }),
    at(1050, { type: 'plan.step.started', stepId: 'rule' }),
    ...tool(1090, 'clause_search', 'T0', { q: 'report within', policy_id: POLICY }, L('TR-7.2: call the 24-hour line within 48 hours', 'TR-7.2：须在 48 小时内致电 24 小时热线'), 280),
    at(1400, { type: 'plan.step.done', stepId: 'rule' }),
    at(1420, { type: 'verify.result', citationsOk: true, numbersOk: true, citations: ['TR-3.1', 'TR-7.2'] }),
    at(1460, { type: 'ui.card', card: { kind: 'PolicySummaryCard', id: cid('pol'), data: { policyId: POLICY } } }),
    at(1560, {
      type: 'message.final',
      verdict: 'covered',
      text: L('Likely yes. Emergency hospital treatment abroad is covered up to ¥500,000 [[TR-3.1]]. One condition matters most: call your insurer\'s 24-hour assistance line within 48 hours of admission [[TR-7.2]], because late reporting can reduce the benefit.', '很可能赔。境外急诊住院治疗最高赔付 ¥500,000 [[TR-3.1]]。最重要的条件是：入院后 48 小时内致电保险公司 24 小时救援热线 [[TR-7.2]]，逾期报案可能减少赔付。'),
      bullets: [L('Dengue is an illness, not an excluded sport or a declared pre-existing condition, so I found no exclusion that applies [[TR-8.1]].', '登革热属于疾病，不是被排除的运动，也不是已申报的既往病症，我没有找到适用的免责条款 [[TR-8.1]]。')],
      citations: ['TR-3.1', 'TR-7.2', 'TR-8.1'],
      chips: [ask('What should I do right now?', '我现在该怎么办？')],
    }),
    done(1620),
  ],
};

export const s7Guide: TurnScript = {
  id: 's7.guide',
  utterances: [L('What should I do right now?', '我现在该怎么办？')],
  keywords: ['what should i do right now', 'do right now', '现在该怎么办', '我现在该怎么'],
  events: (ctx) => [
    understand(ctx, 'incident_guidance', { country: 'TH', policy: POLICY, situation: 'hospitalised' }),
    at(250, { type: 'plan.created', steps: [step('where', L('Find local emergency contacts', '查找当地紧急联系方式')), step('steps', L('Build your steps', '生成处理步骤'))] }),
    at(300, { type: 'plan.step.started', stepId: 'where' }),
    ...tool(340, 'incident_library', 'T0', { country: 'TH', type: 'hospitalisation' }, L('Thailand guide found', '已找到泰国指南'), 280),
    at(650, { type: 'plan.step.done', stepId: 'where' }),
    at(670, { type: 'plan.step.started', stepId: 'steps' }),
    at(1000, { type: 'plan.step.done', stepId: 'steps' }),
    at(1020, { type: 'verify.result', citationsOk: true, numbersOk: true, citations: ['TR-7.2'] }),
    at(1060, { type: 'ui.card', card: { kind: 'IncidentGuideCard', id: cid('incident'), data: { country: incidentFor('TH').country, policyId: POLICY } } }),
    at(1160, {
      type: 'message.final',
      text: L('Your health comes first. If anything is urgent, call Thailand\'s emergency number now. Otherwise: 1) call your insurer\'s 24-hour assistance line, 2) show the hospital your insurance card, 3) keep every bill, receipt and report. I can open a case and write to the hospital in Thai for you, and your insurer\'s assistance team can contact the hospital directly to arrange payment. Tap the hospital below and review what is shared.', '先顾好身体。如有紧急情况，请立即拨打泰国紧急电话。否则请：1）致电保险公司 24 小时救援热线；2）向医院出示保险卡；3）保存所有账单、收据和报告。我可以为您开立案件并用泰语联系医院，保险公司的救援团队也可以直接联系医院安排付款。请点击下方的医院并核对将分享的内容。'),
      citations: ['TR-7.2'],
    }),
    done(1210),
  ],
};

export const s7Guarantee: TurnScript = {
  id: 's7.guarantee',
  utterances: [],
  keywords: ['__s7_guarantee'],
  events: (ctx) => [
    understand(ctx, 'assistance_update', { case: 'TA-58213', country: 'TH' }, 'en'),
    at(250, { type: 'plan.created', steps: [step('hosp', L('Check what the insurer has done with the hospital', '查看保险公司与医院的对接进展')), step('pay', L('Check how the bill will be paid', '确认账单如何支付'))] }),
    at(300, { type: 'plan.step.started', stepId: 'hosp' }),
    ...tool(340, 'assistance_status', 'T0', { case: 'TA-58213' }, L('CPIC assistance contacted Riverside International Hospital', '中国太保救援中心已联系河畔国际医院'), 340),
    at(720, { type: 'plan.step.done', stepId: 'hosp' }),
    at(740, { type: 'plan.step.started', stepId: 'pay' }),
    ...tool(780, 'guarantee_letter_get', 'T0', { case: 'TA-58213', hospital: 'Riverside International' }, L('Guarantee of payment issued: direct billing, up to the ¥500,000 limit', '已出具付款担保：直接结算，最高不超过 ¥500,000 限额'), 380),
    at(1200, { type: 'plan.step.done', stepId: 'pay' }),
    at(1220, { type: 'verify.result', citationsOk: true, numbersOk: true, citations: ['TR-3.1'] }),
    at(1260, { type: 'notify.push', title: L('Hospital contacted', '医院已被联系'), body: L('Your insurer\'s assistance team issued a guarantee of payment.', '保险公司救援团队已出具付款担保。') }),
    at(1320, {
      type: 'message.final',
      text: L('Good news: your insurer\'s assistance team has already contacted Riverside International Hospital and issued a guarantee of payment [[TR-3.1]]. That means direct billing, so you should not need to pay covered items upfront. This depends on the hospital accepting the guarantee. If it ever refuses, you would pay and claim back with the original bills. Your claim now appears under 理赔 and updates as we go.', '好消息：保险公司的救援团队已经联系了河畔国际医院，并出具了付款担保 [[TR-3.1]]。这意味着直接结算，属于保障范围的费用通常无需您先行垫付。前提是医院接受该担保；如果医院拒绝，您需要先付费，再凭账单原件事后报销。您的理赔现已显示在“理赔”中，并会随进展同步更新。'),
      citations: ['TR-3.1'],
    }),
    done(1380),
  ],
};

export const s7Docs: TurnScript = {
  id: 's7.docs',
  utterances: [L('Here are the Thai hospital bill and discharge note', '这是泰文的医院账单和出院小结')],
  keywords: ['thai hospital bill', 'thai bill', 'bill and discharge note', '泰文账单', '泰文的医院账单'],
  events: (ctx) => [
    understand(ctx, 'document_check', { docs: '2', language: 'th', claim: 'xb_001' }),
    at(250, { type: 'plan.created', steps: [step('read', L('Read the Thai documents', '读取泰文材料')), step('tr', L('Translate', '翻译')), step('check', L('Check they agree with each other', '核对材料是否一致'))] }),
    at(300, { type: 'plan.step.started', stepId: 'read' }),
    ...tool(340, 'ocr_extract', 'T1', { file_ids: ['file_th_bill', 'file_th_discharge'], lang: 'th' }, L('2 documents, 11 fields read', '已读取 2 份材料，11 个字段'), 640),
    at(1000, { type: 'plan.step.done', stepId: 'read' }),
    at(1020, { type: 'plan.step.started', stepId: 'tr' }),
    ...tool(1050, 'translate', 'T0', { from: 'th', to: ['en', 'zh'], keep_original: true }, L('Translated. Original Thai kept as evidence', '已翻译，泰文原件保留作证据'), 420),
    at(1500, { type: 'plan.step.done', stepId: 'tr' }),
    at(1520, { type: 'plan.step.started', stepId: 'check' }),
    ...tool(1550, 'consistency_check', 'T0', { docs: ['bill', 'discharge'] }, L('1 issue: discharge date 20 Dec is before admission 22 Dec', '1 处问题：出院日期 12 月 20 日早于入院日期 12 月 22 日'), 360, false),
    at(1950, { type: 'plan.step.done', stepId: 'check', ok: false }),
    at(1980, { type: 'verify.result', citationsOk: true, numbersOk: true }),
    at(2020, {
      type: 'message.final',
      text: L(`I read both documents and translated them (the Thai originals stay attached as evidence). Total billed: ${BILL_THB.toLocaleString('en-US')} THB. One thing doesn't add up: the discharge note says 20 Dec, which is before your admission on 22 Dec. Insurers often query this. Please check the original and tell me the right date.`, `两份材料我都读取并翻译了（泰文原件会作为证据保留）。账单总额：${BILL_THB.toLocaleString('en-US')} 泰铢。有一处对不上：出院小结写的是 12 月 20 日，早于您 12 月 22 日的入院日期。保险公司常会就此提问。请核对原件并告诉我正确日期。`),
      bullets: [L('Admission: 22 Dec 2026 · Hospital: Phuket (fictional)', '入院：2026 年 12 月 22 日 · 医院：普吉（虚构）'), L('Discharge on the note: 20 Dec (looks like a typo)', '小结上的出院日期：12 月 20 日（疑似笔误）')],
      chips: [ask('The discharge date should be 25 Dec', '出院日期应该是 12 月 25 日')],
    }),
    done(2080),
  ],
};

export const s7Fix: TurnScript = {
  id: 's7.fix',
  utterances: [L('The discharge date should be 25 Dec', '出院日期应该是 12 月 25 日')],
  keywords: ['discharge date should', '出院日期应该', '出院日期是'],
  events: (ctx) => [
    understand(ctx, 'correction', { field: 'discharge_date', value: '2026-12-25' }),
    at(250, { type: 'plan.created', steps: [step('fix', L('Apply your correction', '应用您的更正')), step('check', L('Re-check the documents', '重新核对材料')), step('est', L('Estimate the payout', '估算赔付'))] }),
    at(300, { type: 'plan.step.started', stepId: 'fix' }),
    at(560, { type: 'plan.step.done', stepId: 'fix' }),
    at(580, { type: 'plan.step.started', stepId: 'check' }),
    ...tool(610, 'consistency_check', 'T0', { docs: ['bill', 'discharge'], discharge: '2026-12-25' }, L('All dates, names and amounts agree', '日期、姓名和金额均一致'), 320),
    at(980, { type: 'plan.step.done', stepId: 'check' }),
    at(1000, { type: 'plan.step.started', stepId: 'est' }),
    ...tool(1030, 'bill_check', 'T0', { total_thb: BILL_THB, rate_cny_per_thb: RATE, limit_cny: 500_000, deductible: 0 }, L(`${BILL_THB.toLocaleString('en-US')} THB = ${yuan(BILL_CNY)}, within the ¥500,000 limit`, `${BILL_THB.toLocaleString('en-US')} 泰铢 = ${yuan(BILL_CNY)}，未超过 ¥500,000 限额`), 380),
    at(1450, { type: 'plan.step.done', stepId: 'est' }),
    at(1470, { type: 'verify.result', citationsOk: true, numbersOk: true, citations: ['TR-3.1'] }),
    at(1520, {
      type: 'message.final',
      text: L(`Fixed. Everything now agrees. At the demo rate of 1 THB = ¥${RATE.toFixed(2)}, your bill is about ${yuan(BILL_CNY)}, well within the ¥500,000 limit [[TR-3.1]]. This is my estimate, not the insurer's decision. The real exchange rate and the insurer's review decide the final amount.`, `已更正，现在所有信息一致。按演示汇率 1 泰铢 = ¥${RATE.toFixed(2)}，您的账单约 ${yuan(BILL_CNY)}，远低于 ¥500,000 限额 [[TR-3.1]]。这只是我的估算，不是保险公司的决定，最终金额以实际汇率和保险公司审核为准。`),
      citations: ['TR-3.1'],
      chips: [ask('Prepare my claim kit', '准备我的理赔资料包')],
    }),
    done(1580),
  ],
};

export const s7Kit: TurnScript = {
  id: 's7.kit',
  utterances: [L('Prepare my claim kit', '准备我的理赔资料包')],
  keywords: ['claim kit', '理赔资料包'],
  events: (ctx) => [
    understand(ctx, 'claim_kit', { claim: 'xb_001', country: 'TH' }),
    at(250, { type: 'plan.created', steps: [step('build', L('Assemble the kit', '整理资料包')), step('review', L('Show you exactly what is in it', '向您展示包内全部内容'))] }),
    at(300, { type: 'plan.step.started', stepId: 'build' }),
    ...tool(340, 'crossborder_kit_build', 'T1', { claim: 'xb_001', items: ['english_summary', 'thai_originals', 'translations', 'claim_form'] }, L('4 items ready for your review', '4 项内容待您核对'), 520),
    at(900, { type: 'plan.step.done', stepId: 'build' }),
    at(920, { type: 'plan.step.started', stepId: 'review' }),
    at(1100, { type: 'plan.step.done', stepId: 'review' }),
    at(1120, { type: 'verify.result', citationsOk: true, numbersOk: true }),
    at(1160, { type: 'guard.confirm_required', actionId: 'act_xb_kit', what: L('Download your cross-border claim kit', '下载您的跨境理赔资料包'), why: L('It is only saved for you. Nothing is sent to the insurer.', '仅保存给您本人，不会发送给保险公司。') }),
    at(1200, {
      type: 'ui.card',
      card: {
        kind: 'ConfirmActionCard', id: cid('confirm'),
        data: {
          actionId: 'act_xb_kit', title: L('Download this claim kit?', '下载此理赔资料包？'),
          what: L('A package for you to review and submit through your insurer\'s official channel', '供您核对并通过保险公司官方渠道提交的资料包'),
          to: L('You only (download)', '仅限您本人（下载）'),
          shared: [L('English summary of the incident', '事件英文摘要'), L('Original Thai bill and discharge note', '泰文账单和出院小结原件'), L('English and Chinese translations', '英文和中文译文'), L('Claim form, pre-filled for your review', '预填的理赔表格，待您核对')],
          expiresInSec: 600,
        },
      },
    }),
    at(1300, { type: 'message.final', text: L('Your kit is ready to review. Check the list, then confirm to download it. I will not send anything to your insurer on your behalf.', '资料包已准备好待核对。请查看清单并确认下载。我不会替您向保险公司发送任何内容。') }),
    done(1350),
  ],
};

export const s7Status: TurnScript = {
  id: 's7.status',
  utterances: [L('How long will it take?', '这个需要多久？')],
  keywords: ['how long will it take', '这个需要多久', '需要多久'],
  events: (ctx) => [
    understand(ctx, 'claim_timeline', { claim: 'xb_001' }),
    at(250, { type: 'plan.created', steps: [step('next', L('Work out the next steps', '梳理后续步骤'))] }),
    at(300, { type: 'plan.step.started', stepId: 'next' }),
    at(700, { type: 'plan.step.done', stepId: 'next' }),
    at(720, { type: 'verify.result', citationsOk: true, numbersOk: true }),
    at(780, {
      type: 'message.final',
      text: L('I can\'t promise a date, because only your insurer decides. Overseas claims often take longer than domestic ones, since originals and translations are checked. Here is what happens next, and where I can help.', '我无法承诺具体日期，因为只有保险公司能决定。境外理赔通常比境内更久，因为需要核对原件和译文。接下来的步骤以及我能帮忙的地方如下。'),
      bullets: [
        L('You submit the kit through your insurer\'s official channel.', '您通过保险公司官方渠道提交资料包。'),
        L('The insurer reviews the originals. With direct billing it settles with the hospital, and any balance is reimbursed to you.', '保险公司审核原件。直接结算时由其与医院结算，余额报销给您。'),
        L('The insurer may ask for more documents. I will draft the reply for you to approve.', '保险公司可能要求补充材料，我会起草回复供您确认。'),
        L('If it is declined or delayed, I explain why in plain language and what you can do next.', '如被拒赔或延迟，我会用通俗语言解释原因和您可以怎么做。'),
      ],
      chips: [ask('Talk to a licensed agent', '联系持牌顾问')],
    }),
    done(830),
  ],
};
