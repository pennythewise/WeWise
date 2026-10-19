import { L } from '../l';
import { at, chip, cid, done, step, tool, understand, type TurnScript } from '../script';

const wait = (inception: string, eligible: string, incident: string, ok: boolean) => ({ inception, eligible, incident, ok });

export const s3Prescreen: TurnScript = {
  id: 's3.prescreen',
  utterances: [L('I was admitted on 10 Oct', '我 10 月 10 日住院了')],
  keywords: ['admitted', 'prepare a claim', 'file a claim', 'submit a claim', 'make a claim', '住院了', '准备理赔', '我要理赔'],
  events: (ctx) => {
    const w = wait('2025-11-25', '2026-02-23', '2026-10-10', true);
    return [
      understand(ctx, 'claim_prescreen', { incident_date: w.incident, type: 'hospitalisation', policy: 'pol_mei_health_01' }),
      at(250, { type: 'plan.created', steps: [step('policy', L('Find the right policy', '确定相关保单')), step('wait', L('Check the waiting period', '核对等待期')), step('excl', L('Check exclusions', '核对免责条款')), step('screen', L('Pre-screen the claim', '理赔预审'))] }),
      at(300, { type: 'plan.step.started', stepId: 'policy' }),
      ...tool(340, 'policy_lookup', 'T0', { user: 'usr_mei', type: 'medical' }, L('1 medical policy: Ping An e-Sheng Bao Medical', '1 份医疗保单：平安e生保·百万医疗'), 250),
      at(650, { type: 'plan.step.done', stepId: 'policy' }),
      at(670, { type: 'plan.step.started', stepId: 'wait' }),
      ...tool(710, 'waiting_period_check', 'T0', { inception: w.inception, days: 90, incident: w.incident }, L('Eligible from 2026-02-23. Incident is 229 days after.', '2026-02-23 起可理赔，事故发生在其后 229 天。'), 280),
      at(1050, { type: 'plan.step.done', stepId: 'wait' }),
      at(1070, { type: 'plan.step.started', stepId: 'excl' }),
      ...tool(1110, 'exclusion_check', 'T0', { policy: 'pol_mei_health_01', incident: 'dengue fever' }, L('0 exclusions matched', '未命中免责条款'), 300),
      at(1450, { type: 'plan.step.done', stepId: 'excl' }),
      at(1470, { type: 'plan.step.started', stepId: 'screen' }),
      at(1700, { type: 'verify.result', citationsOk: true, numbersOk: true, citations: ['HS-4.2', 'HS-3.4', 'HS-7.1'] }),
      at(1750, { type: 'plan.step.done', stepId: 'screen' }),
      at(1800, { type: 'ui.card', card: { kind: 'ClaimPrescreenCard', id: cid('prescreen'), data: { policyId: 'pol_mei_health_01', verdict: 'likely_covered', inception: w.inception, eligible: w.eligible, incident: w.incident, waitingDays: 90, exclusions: [], missing: [L('Discharge summary', '出院小结'), L('Itemised hospital bill', '医院费用明细账单')] } } }),
      at(1950, {
        type: 'message.final',
        text: L('This looks likely covered under your Ping An e-Sheng Bao Medical. Only the insurer can decide, and I can\'t promise approval. You have until about 11 Jan 2027 to submit [[HS-7.1]].', '根据您的平安e生保·百万医疗，这次住院看起来很可能获得赔付。最终由保险公司决定，我无法保证获批。您需要在 2027 年 1 月 11 日前提交 [[HS-7.1]]。'),
        citations: ['HS-4.2', 'HS-7.1'],
        chips: [chip(L('Prepare my documents', '准备理赔材料'), L('Prepare my documents', '准备理赔材料')), chip(L('What if I was abroad?', '如果我当时在国外呢？'), L('What if I was admitted abroad?', '如果我是在国外住院呢？'))],
      }),
      done(2000),
    ];
  },
};

export const s3Excluded: TurnScript = {
  id: 's3.excluded',
  utterances: [L('What if I was admitted abroad?', '如果我是在国外住院呢？')],
  keywords: ['abroad?', 'admitted abroad', 'excluded variant', '国外住院'],
  events: (ctx) => [
    understand(ctx, 'claim_prescreen', { incident_date: '2026-10-10', type: 'hospitalisation', policy: 'pol_mei_travel_01' }),
    at(250, { type: 'plan.created', steps: [step('wait', L('Check the cover period', '核对保障期间')), step('screen', L('Pre-screen the claim', '理赔预审'))] }),
    at(300, { type: 'plan.step.started', stepId: 'wait' }),
    ...tool(340, 'waiting_period_check', 'T0', { inception: '2026-12-20', incident: '2026-10-10' }, L('Incident is 71 days before the cover starts', '事故发生在保障开始前 71 天'), 260),
    at(700, { type: 'plan.step.done', stepId: 'wait' }),
    at(720, { type: 'plan.step.started', stepId: 'screen' }),
    at(1000, { type: 'verify.result', citationsOk: true, numbersOk: true, citations: ['TR-3.1'] }),
    at(1050, { type: 'plan.step.done', stepId: 'screen' }),
    at(1100, { type: 'ui.card', card: { kind: 'ClaimPrescreenCard', id: cid('prescreen'), data: { policyId: 'pol_mei_travel_01', verdict: 'likely_excluded', inception: '2026-12-20', eligible: '2026-12-20', incident: '2026-10-10', waitingDays: 0, exclusions: [{ clauseId: 'TR-3.1' }], missing: [] } } }),
    at(1250, { type: 'message.final', text: L('Under your travel plan this would likely be excluded: it only covers emergency treatment abroad during the trip, which starts on 20 Dec [[TR-3.1]]. Your health plan is the one to use.', '按您的旅行险，这次住院很可能不赔：它只保障旅程期间在境外的紧急治疗，而旅程从 12 月 20 日才开始 [[TR-3.1]]。应使用您的医疗险。'), citations: ['TR-3.1'], chips: [chip(L('Prepare my documents', '准备理赔材料'), L('Prepare my documents', '准备理赔材料'))] }),
    done(1300),
  ],
};

export const s3Prepare: TurnScript = {
  id: 's3.prepare',
  utterances: [L('Prepare my documents', '准备理赔材料')],
  keywords: ['prepare my documents', 'checklist', 'documents do i need', '准备材料', '需要哪些材料'],
  events: (ctx) => [
    understand(ctx, 'claim_checklist', { policy: 'pol_mei_health_01', incident: 'hospitalisation', country: 'CN' }),
    at(250, { type: 'plan.created', steps: [step('build', L('Build the checklist', '生成材料清单')), step('read', L('Check documents on file', '核对已有材料'))] }),
    at(300, { type: 'plan.step.started', stepId: 'build' }),
    ...tool(340, 'checklist_build', 'T0', { policy: 'pol_mei_health_01', incident: 'hospitalisation', country: 'CN' }, L('5 items for hospitalisation in China', '中国住院理赔共 5 项材料'), 330),
    at(750, { type: 'plan.step.done', stepId: 'build' }),
    at(770, { type: 'plan.step.started', stepId: 'read' }),
    ...tool(800, 'claim_docs_list', 'T0', { claim: 'clm_mei_001' }, L('3 of 5 already prepared', '5 项中已有 3 项'), 220),
    at(1100, { type: 'plan.step.done', stepId: 'read' }),
    at(1150, { type: 'ui.card', card: { kind: 'ChecklistCard', id: cid('checklist'), data: { claimId: 'clm_mei_001' } } }),
    at(1300, { type: 'message.final', text: L('3 of 5 items are ready. Add your discharge summary and the itemised bill, and I\'ll check them for you.', '5 项材料中已有 3 项。请补充出院小结和费用明细账单，我会帮您核对。') }),
    done(1350),
  ],
};

export const s3ReadDoc: TurnScript = {
  id: 's3.read_doc',
  utterances: [],
  keywords: ['__turn_read_doc'],
  events: (ctx) => {
    const discharge = ctx.text.includes('discharge');
    return [
      understand(ctx, 'read_claim_document', { doc: discharge ? 'discharge_summary' : 'itemised_bill' }, 'en'),
      at(250, { type: 'plan.created', steps: [step('ocr', L('Read the document', '读取文件')), step('check', L('Check it against the claim', '与理赔信息对照'))] }),
      at(300, { type: 'plan.step.started', stepId: 'ocr' }),
      ...tool(340, 'ocr_extract', 'T1', { doc: discharge ? 'discharge_summary' : 'itemised_bill' }, discharge ? L('4 fields read', '已读取 4 个字段') : L('3 fields read', '已读取 3 个字段'), 500),
      at(900, { type: 'plan.step.done', stepId: 'ocr' }),
      at(920, { type: 'guard.pii_masked', fields: [L('patient name', '患者姓名')] }),
      at(950, { type: 'plan.step.started', stepId: 'check' }),
      ...tool(980, 'consistency_check', 'T0', { rule: discharge ? 'discharge >= admission' : 'total == sum(items)' }, discharge ? L('Inconsistency: discharge date before admission', '发现不一致：出院日期早于入院日期') : L('Consistent', '一致'), 220, true),
      at(1300, { type: 'plan.step.done', stepId: 'check' }),
      at(1350, {
        type: 'message.final',
        text: discharge
          ? L('I read the discharge summary, but the discharge date is earlier than the admission date. Please check it and correct if needed.', '我读了出院小结，但出院日期早于入院日期，请核对，必要时更正。')
          : L('I read the itemised bill. The numbers add up. Please confirm the fields.', '我读了费用明细账单，数字相符，请确认字段。'),
      }),
      done(1400),
    ];
  },
};

export const s3Validate: TurnScript = {
  id: 's3.validate',
  utterances: [],
  keywords: ['__turn_validate'],
  events: (ctx) => [
    understand(ctx, 'claim_validate', { claim: 'clm_mei_001' }, 'en'),
    at(250, { type: 'plan.created', steps: [step('val', L('Validate the claim file', '校验理赔材料')), step('prev', L('Prepare the submission', '准备提交'))] }),
    at(300, { type: 'plan.step.started', stepId: 'val' }),
    ...tool(340, 'claim_validate', 'T1', { claim: 'clm_mei_001' }, L('5 of 5 documents present, 0 inconsistencies', '5 项材料齐全，无不一致'), 500),
    at(900, { type: 'plan.step.done', stepId: 'val' }),
    at(920, { type: 'plan.step.started', stepId: 'prev' }),
    ...tool(950, 'claim_submit_preview', 'T1', { claim: 'clm_mei_001' }, L('Preview ready. Waiting for your confirmation.', '预览已生成，等待您确认。'), 300),
    at(1300, { type: 'guard.confirm_required', actionId: 'act_claim_submit', what: L('Submit claim to Ping An', '向中国平安提交理赔'), why: L('Submitting a claim is irreversible, so it needs your confirmation.', '提交理赔后无法撤回，因此需要您确认。') }),
    at(1350, { type: 'plan.step.done', stepId: 'prev' }),
    at(1400, {
      type: 'ui.card',
      card: {
        kind: 'ConfirmActionCard', id: cid('confirm'),
        data: {
          actionId: 'act_claim_submit',
          title: L('Confirm claim submission', '确认提交理赔'),
          what: L('Submit claim for dengue hospitalisation (¥18,420)', '提交登革热住院理赔（¥18,420）'),
          to: L('Ping An · claims team', '中国平安 · 理赔部'),
          shared: [L('Claim form', '理赔申请表'), L('Identity document (masked)', '身份证明（已脱敏）'), L('Discharge summary', '出院小结'), L('Itemised bill', '费用明细账单')],
          payout: '•••• •••• 4821',
          expiresInSec: 300,
        },
      },
    }),
    at(1450, { type: 'message.final', text: L('Everything is in place. Please review and confirm. Nothing is submitted until you do.', '材料已齐全，请核对并确认。在您确认之前不会提交。') }),
    done(1500),
  ],
};

export const s3SubmitDone: TurnScript = {
  id: 's3.submitted',
  utterances: [],
  keywords: ['__turn_submitted'],
  events: (ctx) => [
    understand(ctx, 'claim_submit', { claim: 'clm_mei_001' }, 'en'),
    at(250, { type: 'plan.created', steps: [step('send', L('Send to the insurer', '提交给保险公司'))] }),
    at(300, { type: 'plan.step.started', stepId: 'send' }),
    ...tool(340, 'claim_submit', 'T3', { claim: 'clm_mei_001', action_id: 'act_claim_submit', payout: '•••• 4821' }, L('Submitted. Reference HM-CL-70418', '已提交，受理编号 HM-CL-70418'), 700),
    at(1100, { type: 'plan.step.done', stepId: 'send' }),
    at(1150, { type: 'ui.card', card: { kind: 'ClaimStatusCard', id: cid('status'), data: { claimId: 'clm_mei_001' } } }),
    at(1300, { type: 'message.final', text: L('Submitted. Your reference is HM-CL-70418. Materials prepared is not approval: the insurer will review it now. I\'ll tell you if they need anything.', '已提交，受理编号为 HM-CL-70418。材料齐全不等于获批，保险公司现在开始审核，如需补充材料我会通知您。'), chips: [chip(L('Why is it taking long?', '为什么这么久？'), L('Why is it taking long?', '为什么这么久？'))] }),
    done(1350),
  ],
};

export const s3Advance: TurnScript = {
  id: 's3.advance',
  utterances: [],
  keywords: ['__turn_advance'],
  events: (ctx) => [
    understand(ctx, 'simulate_time', { days: '3' }, 'en'),
    at(250, { type: 'plan.created', steps: [step('poll', L('Check the claim status', '查询理赔状态'))] }),
    at(300, { type: 'plan.step.started', stepId: 'poll' }),
    ...tool(340, 'claim_status', 'T0', { claim: 'clm_mei_001' }, L('INFO_REQUESTED · waiting on you', '需补充资料 · 等待您处理'), 300),
    at(700, { type: 'plan.step.done', stepId: 'poll' }),
    at(750, { type: 'notify.push', title: L('Ping An needs one more thing', '中国平安需要补充一项材料'), body: L('Your claim needs an itemised bill from the pharmacy.', '您的理赔需要药房出具的费用明细账单。') }),
    at(800, { type: 'ui.card', card: { kind: 'ClaimStatusCard', id: cid('status'), data: { claimId: 'clm_mei_001' } } }),
    at(900, { type: 'message.final', text: L('3 days later: the insurer has asked for one more document. The claim is now waiting on you.', '三天后：保险公司要求补充一份材料，理赔目前在等您处理。'), chips: [chip(L('Why is it taking long?', '为什么这么久？'), L('Why is it taking long?', '为什么这么久？'))] }),
    done(950),
  ],
};

export const s3Explain: TurnScript = {
  id: 's3.explain',
  utterances: [L('Why is it taking long?', '为什么这么久？')],
  keywords: ['taking long', 'why is it', 'how long', 'plain words', '为什么这么久', '怎么这么慢', '通俗'],
  events: (ctx) => [
    understand(ctx, 'explain_delay', { claim: 'clm_mei_001' }),
    at(250, { type: 'plan.created', steps: [step('status', L('Read the claim timeline', '查看理赔时间线')), step('explain', L('Explain in plain words', '用通俗的话解释'))] }),
    at(300, { type: 'plan.step.started', stepId: 'status' }),
    ...tool(340, 'claim_status', 'T0', { claim: 'clm_mei_001' }, L('INFO_REQUESTED · waiting_on: user', '需补充资料 · 等待方：用户'), 280),
    at(700, { type: 'plan.step.done', stepId: 'status' }),
    at(720, { type: 'plan.step.started', stepId: 'explain' }),
    at(1000, { type: 'plan.step.done', stepId: 'explain' }),
    at(1050, { type: 'verify.result', citationsOk: true, numbersOk: true, citations: ['HS-7.1'] }),
    at(1100, {
      type: 'message.final',
      text: L('The claim is paused, but not because the insurer is slow. They asked for one more document, an itemised pharmacy bill, and they can\'t continue until you send it. Once you add it, review usually restarts the same day. This is my reading of the timeline. Only the insurer decides.', '理赔暂停并不是因为保险公司拖延，而是他们要求补充一份药房费用明细账单，在您提供之前无法继续。补交后，审核通常当天重新开始。这是我对时间线的理解，最终由保险公司决定。'),
      bullets: [L('Waiting on: you', '等待方：您'), L('Next step: add the pharmacy bill', '下一步：补交药房账单'), L('Deadline to submit claims: 90 days after discharge [[HS-7.1]]', '索赔提交期限：出院后 90 天 [[HS-7.1]]')],
      citations: ['HS-7.1'],
    }),
    done(1150),
  ],
};
