import { L } from './l';
import { at, done, step, tool, type TimedEvent } from './script';
import { s3SubmitDone } from './scenarios/s3_claim';
import type { TurnCtx } from './script';

type Outcome = (ctx: TurnCtx) => TimedEvent[];
/** What happens when the user confirms or rejects a pending sensitive action (PRD E5). */
export const ACTIONS: Record<string, { confirm: Outcome; reject: Outcome }> = {
  act_handoff: {
    confirm: () => [
      at(120, { type: 'understand.done', intent: 'confirm_handoff', slots: { agent: 'ag_chen' }, language: 'en' }),
      at(250, { type: 'plan.created', steps: [step('send', L('Share the masked summary', '分享脱敏摘要'))] }),
      at(300, { type: 'plan.step.started', stepId: 'send' }),
      ...tool(340, 'handoff_send', 'T3', { agent: 'ag_chen', items: ['name', 'phone', 'needs', 'comparison'], masked: true }, L('Shared. Ticket WW-20418', '已分享，工单号 WW-20418'), 600),
      at(1000, { type: 'plan.step.done', stepId: 'send' }),
      at(1100, { type: 'message.final', text: L('Shared with Daniel Chen. Your ticket is WW-20418, and you should hear back in about 15 minutes. You can see what I shared on the Memory page.', '已分享给陈大伟顾问，工单号 WW-20418，预计约 15 分钟内回复。您可以在“记忆”页面查看我分享了什么。') }),
      done(1150),
    ],
    reject: () => [
      at(200, { type: 'message.final', text: L('No problem. Nothing was shared.', '没问题，没有分享任何信息。') }),
      done(250),
    ],
  },
  act_followup_send: {
    confirm: () => [
      at(120, { type: 'understand.done', intent: 'send_followup', slots: { claim: 'clm_mei_001' }, language: 'en' }),
      at(250, { type: 'plan.created', steps: [step('send', L('Send through the insurer\'s official channel', '通过保险公司官方渠道发送'))] }),
      at(300, { type: 'plan.step.started', stepId: 'send' }),
      ...tool(340, 'claim_reply_send', 'T3', { claim: 'clm_mei_001', attachments: 1 }, L('Sent. Insurer acknowledged.', '已发送，保险公司已确认收到。'), 500),
      at(900, { type: 'plan.step.done', stepId: 'send' }),
      at(950, { type: 'notify.push', title: L('Your insurer received your reply', '保险公司已收到您的回复'), body: L('Your claim is back in review. Usual reply: 2–3 working days.', '您的理赔已重新进入审核，通常 2–3 个工作日内回复。') }),
      at(1000, { type: 'message.final', text: L('Sent. Your claim is back with the insurer for review. I\'ll let you know when it moves.', '已发送，您的理赔已回到保险公司审核中，有进展我会通知您。') }),
      done(1050),
    ],
    reject: () => [
      at(200, { type: 'message.final', text: L('Not sent. The draft is kept if you change your mind.', '未发送，草稿已保留。') }),
      done(250),
    ],
  },
  act_claim_submit: {
    confirm: (ctx) => s3SubmitDone.events(ctx),
    reject: () => [
      at(200, { type: 'message.final', text: L('Cancelled. Nothing was submitted, and your documents are still saved.', '已取消，没有提交任何内容，您的材料仍已保存。') }),
      done(250),
    ],
  },
};
