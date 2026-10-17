import { L } from '../l';
import { at, chip, cid, done, step, tool, understand, type TurnScript } from '../script';
import { incidentFor } from '@/mock/incidents';

export const s6Colloquial: TurnScript = {
  id: 's6.colloquial',
  utterances: [L('这个能 claim 吗？my hospital bill 8k', '这个能 claim 吗？my hospital bill 8k')],
  keywords: ['能 claim', 'claim 吗', '能不能 claim'],
  events: (ctx) => [
    understand(ctx, 'claim_eligibility', { amount: '¥8,000', policy: 'unknown', register: 'colloquial' }, 'zh+en (code-switched)'),
    at(250, { type: 'plan.created', steps: [step('pol', L('Work out which policy', '确定是哪份保单')), step('answer', L('Check eligibility', '核对是否可理赔'))] }),
    at(300, { type: 'plan.step.started', stepId: 'pol' }),
    ...tool(340, 'policy_lookup', 'T0', { user: 'usr_mei' }, L('5 policies could apply. Need to ask.', '有 5 份保单可能适用，需要询问。'), 250),
    at(700, { type: 'plan.step.done', stepId: 'pol' }),
    at(800, { type: 'message.final', text: L('Sure, let me check. Which policy is this bill for? You have five.', '可以，我来查一下。这笔账单是用哪一份保单？您有五份。'), chips: [chip(L('My health plan', '我的医疗险'), L('My health plan', '我的医疗险')), chip(L('No, my travel one', '不，是我的旅行险'), L('No, my travel one', '不，是我的旅行险'))] }),
    done(850),
  ],
};

export const s6Correct: TurnScript = {
  id: 's6.correct',
  utterances: [L('No, my travel one', '不，是我的旅行险')],
  keywords: ['my travel one', 'travel one', 'my travel plan', 'travel policy', '旅行险'],
  events: (ctx) => [
    understand(ctx, 'correction', { policy: 'pol_mei_travel_01', amount: '¥8,000' }),
    at(250, { type: 'plan.replanned', reason: L('You corrected the policy to the travel plan, so I\'m starting again from there.', '您把保单更正为旅行险，所以我从这里重新开始。'), steps: [step('pol', L('Use the travel policy', '使用旅行险保单')), step('answer', L('Check eligibility', '核对是否可理赔'))] }),
    at(300, { type: 'plan.step.started', stepId: 'pol' }),
    ...tool(340, 'clause_search', 'T0', { q: 'hospital bill medical abroad', policy_id: 'pol_mei_travel_01' }, L('2 clauses: TR-3.1, TR-7.2', '2 条相关条款：TR-3.1、TR-7.2'), 380),
    at(760, { type: 'plan.step.done', stepId: 'pol' }),
    at(780, { type: 'plan.step.started', stepId: 'answer' }),
    at(1100, { type: 'verify.result', citationsOk: true, numbersOk: true, citations: ['TR-3.1', 'TR-7.2'] }),
    at(1150, { type: 'plan.step.done', stepId: 'answer' }),
    at(1200, {
      type: 'message.final',
      verdict: 'depends',
      text: L('Not for this bill, I think. It depends on where and when the treatment happened.', '这笔账单我认为不行，要看治疗发生的地点和时间。'),
      bullets: [
        L('The travel plan only covers emergency treatment outside mainland China during the trip [[TR-3.1]].', '旅行险只保障旅程期间在中国大陆境外的紧急治疗 [[TR-3.1]]。'),
        L('Your trip starts on 20 Dec, so a bill from a mainland hospital now is outside this policy.', '您的旅程 12 月 20 日才开始，所以现在在内地医院产生的账单不在此保单范围内。'),
        L('If it happened on the trip, report it within 48 hours [[TR-7.2]].', '如果发生在旅程中，须在 48 小时内报案 [[TR-7.2]]。'),
      ],
      citations: ['TR-3.1', 'TR-7.2'],
      chips: [chip(L('Check my health plan instead', '改查我的医疗险'), L('Am I covered for dengue hospitalisation?', '登革热住院在保障范围内吗？')), chip(L('Talk to a licensed agent', '联系持牌顾问'), L('Talk to a licensed agent', '联系持牌顾问'))],
    }),
    done(1250),
  ],
};

export const fallbackOos: TurnScript = {
  id: 'fallback.oos',
  utterances: [L('Buy me Bitcoin', '帮我买比特币')],
  keywords: ['bitcoin', 'crypto', 'stock', 'buy me', 'weather', '比特币', '股票', '天气'],
  events: (ctx) => [
    understand(ctx, 'out_of_scope', { topic: 'trading' }),
    at(250, { type: 'plan.created', steps: [step('scope', L('Check it is in scope', '确认是否在服务范围内'))] }),
    at(300, { type: 'plan.step.started', stepId: 'scope' }),
    at(500, { type: 'plan.step.done', stepId: 'scope', ok: false }),
    at(600, { type: 'message.final', text: L('I can\'t help with that. I\'m built for insurance. Here is what I can do:', '这个我帮不上忙，我专注于保险。我可以帮您：'), chips: [chip(L('Understand a policy', '看懂一份保单'), L('Use sample policy', '使用示例保单')), chip(L('Prepare a claim', '准备理赔'), L('I was admitted on 10 Oct', '我 10 月 10 日住院了')), chip(L('Compare plans', '比较保险'), L('Compare hospital plans for me', '帮我比较住院保险'))] }),
    done(650),
  ],
};

export const incidentGuide: TurnScript = {
  id: 'incident.guide',
  utterances: [L('I had an accident abroad', '我在国外出了事故')],
  keywords: ['accident abroad', 'car accident', 'in an accident', 'what do i do if', '国外出了', '出事故', '车祸'],
  events: (ctx) => [
    understand(ctx, 'incident_guidance', { country: 'TH', policy: 'pol_mei_travel_01' }),
    at(250, { type: 'plan.created', steps: [step('where', L('Work out the country', '确定所在国家')), step('guide', L('Build the steps', '生成处理步骤')), step('deadline', L('Check your reporting deadline', '核对报案期限'))] }),
    at(300, { type: 'plan.step.started', stepId: 'where' }),
    ...tool(340, 'incident_library', 'T0', { country: 'TH', type: 'accident' }, L('Thailand guide found', '已找到泰国指南'), 280),
    at(650, { type: 'plan.step.done', stepId: 'where' }),
    at(670, { type: 'plan.step.started', stepId: 'guide' }),
    ...tool(700, 'clause_search', 'T0', { q: 'report within', policy_id: 'pol_mei_travel_01' }, L('TR-7.2: report within 48 hours', 'TR-7.2：须在 48 小时内报案'), 300),
    at(1050, { type: 'plan.step.done', stepId: 'guide' }),
    at(1070, { type: 'plan.step.started', stepId: 'deadline' }),
    at(1300, { type: 'verify.result', citationsOk: true, numbersOk: true, citations: ['TR-7.2'] }),
    at(1350, { type: 'plan.step.done', stepId: 'deadline' }),
    at(1400, { type: 'ui.card', card: { kind: 'IncidentGuideCard', id: cid('incident'), data: { country: incidentFor('TH').country, policyId: 'pol_mei_travel_01' } } }),
    at(1500, { type: 'message.final', text: L('I\'m sorry, that sounds stressful. First make sure everyone is safe. Here is what to do step by step, and who to call. Report it to your insurer within 48 hours [[TR-7.2]].', '很抱歉，这一定很让人紧张。先确保大家安全。以下是按顺序的处理步骤和需要联系的电话，请在 48 小时内向保险公司报案 [[TR-7.2]]。'), citations: ['TR-7.2'] }),
    done(1550),
  ],
};

export const escalate: TurnScript = {
  id: 'escalate.human',
  utterances: [L('I want to complain about my claim decision', '我想投诉我的理赔结果')],
  keywords: ['complain', 'dispute', 'appeal', 'angry', 'upset', 'unfair', '投诉', '申诉', '不公平', '很生气', '害怕'],
  events: (ctx) => [
    understand(ctx, 'dispute', { sentiment: 'distressed' }),
    at(250, { type: 'plan.created', steps: [step('rule', L('Check when a person should step in', '判断是否需要真人介入'))] }),
    at(300, { type: 'plan.step.started', stepId: 'rule' }),
    at(600, { type: 'plan.step.done', stepId: 'rule' }),
    at(650, { type: 'guard.denied', reasonCode: 'ESCALATE_DISPUTE', title: L('Escalating to a person', '转交真人处理'), why: L('Disputes and distress are handled by a licensed person, not by me.', '争议与情绪困扰应由持牌真人处理，而不是由我来处理。') }),
    at(700, { type: 'ui.card', card: { kind: 'EscalationCard', id: cid('esc'), data: { reason: L('You are disputing a decision. I can explain it, but I can\'t overturn it.', '您对结果有异议。我可以解释，但无法推翻结果。') } } }),
    at(800, { type: 'message.final', text: L('I\'m sorry this has been frustrating. I can explain a decision but I can\'t overturn it. A licensed person can look at appeals with you.', '很抱歉让您感到不愉快。我可以解释结果，但无法推翻。持牌的真人顾问可以陪您处理申诉。'), chips: [chip(L('Talk to a licensed agent', '联系持牌顾问'), L('Talk to a licensed agent', '联系持牌顾问'))] }),
    done(850),
  ],
};
