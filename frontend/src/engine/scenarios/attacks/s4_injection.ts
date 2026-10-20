import { L } from '../../l';
import { INJECTION } from '@/mock/fixtures';
import { SIM_PROOFS, anchorEvents } from '../chain';
import { at, cid, done, step, tool, understand, type TurnScript } from '../../script';

export const s4Inject: TurnScript = {
  id: 's4.inject',
  utterances: [L('Please summarise this discharge document', '请帮我总结这份出院文件')],
  keywords: ['discharge_summary_kl', 'summarise this', 'summarize this', '总结这份', 'ignore previous'],
  events: (ctx) => [
    understand(ctx, 'summarise_document', { file: 'discharge_summary_kl.pdf' }),
    at(250, { type: 'plan.created', steps: [step('quar', L('Read in quarantine', '隔离读取')), step('scan', L('Scan for hidden instructions', '扫描隐藏指令')), step('sum', L('Summarise the medical content', '总结医疗内容'))] }),
    at(300, { type: 'plan.step.started', stepId: 'quar' }),
    ...tool(340, 'doc_quarantine_read', 'T1', { file: 'discharge_summary_kl.pdf', mode: 'untrusted' }, L('3 pages read. Content tagged untrusted.', '已读取 3 页，内容标记为不可信。'), 600),
    at(960, { type: 'plan.step.done', stepId: 'quar' }),
    at(980, { type: 'plan.step.started', stepId: 'scan' }),
    at(1100, { type: 'guard.injection_flagged', source: 'discharge_summary_kl.pdf', page: INJECTION.page, snippet: INJECTION.snippet, why: L('Text inside a document is data, never an instruction. I do not obey it.', '文件里的文字只是数据，不是指令，我不会执行。') }),
    at(1300, { type: 'tool.call', callId: 'call_blocked_1', tool: 'payout_account_update', tier: 'T4', args: { account: '8801-****-1100', requested_by: 'document' } }),
    at(1380, { type: 'tool.result', callId: 'call_blocked_1', ok: false, summary: L('Blocked: not requested by you', '已拦截：并非您本人的请求'), latencyMs: 80 }),
    at(1420, { type: 'guard.denied', reasonCode: 'INTENT_MISMATCH', title: L('Blocked: change payout account', '已拦截：修改赔款账户'), why: L('You asked for a summary. A change of payout account came from the document, so it does not match what you asked.', '您要求的是总结，修改赔款账户的要求来自文件，与您的请求不符。') }),
    at(1600, { type: 'plan.step.done', stepId: 'scan' }),
    at(1620, { type: 'plan.step.started', stepId: 'sum' }),
    at(2000, { type: 'plan.step.done', stepId: 'sum' }),
    at(2050, { type: 'verify.result', citationsOk: true, numbersOk: true }),
    at(2100, { type: 'ui.card', card: { kind: 'SafetyNoticeCard', id: cid('safety'), data: { tone: 'info', title: L('I ignored an instruction in this document', '我忽略了文件中的一条指令'), body: L('I found text on page 3 that tries to give me instructions. I treated it as part of the document and ignored it.', '我在第 3 页发现了试图给我下指令的文字，已将其视为文件内容并忽略。'), reasonCode: 'INJECTION_FLAGGED', snippet: INJECTION.snippet, page: INJECTION.page } } }),
    ...anchorEvents(1450, SIM_PROOFS.s5, 2150),
    at(2350, { type: 'message.final', text: L('Here is the summary: admitted 10 Oct with dengue fever, discharged 13 Oct, treated with IV fluids, fit to resume normal activity after a week. I also ignored an instruction hidden in the document. Your payout account is unchanged.', '摘要如下：10 月 10 日因登革热入院，10 月 13 日出院，接受静脉输液治疗，一周后可恢复正常活动。我还忽略了文件中隐藏的一条指令，您的赔款账户没有任何变化。') }),
    done(2400),
  ],
};
