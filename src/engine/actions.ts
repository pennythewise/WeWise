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
  act_xb_kit: {
    confirm: () => [
      at(120, { type: 'understand.done', intent: 'export_claim_kit', slots: { claim: 'xb_001' }, language: 'en' }),
      at(250, { type: 'plan.created', steps: [step('export', L('Save the kit for you', '为您保存资料包'))] }),
      at(300, { type: 'plan.step.started', stepId: 'export' }),
      ...tool(340, 'crossborder_kit_export', 'T3', { claim: 'xb_001', recipient: 'user_download_only', external_delivery: false }, L('Kit saved for download. Nothing sent to the insurer', '资料包已保存供下载，未发送给保险公司'), 520),
      at(900, { type: 'plan.step.done', stepId: 'export' }),
      at(950, { type: 'message.final', text: L('Your claim kit is ready to download. It contains the English summary, the Thai originals, the translations and a pre-filled claim form. Nothing was sent to your insurer. When you are ready, submit it through your insurer\'s official channel.', '您的理赔资料包已可下载，包含英文摘要、泰文原件、译文和预填的理赔表格。没有任何内容发送给保险公司，准备好后请通过保险公司官方渠道提交。'), chips: [{ label: L('How long will it take?', '这个需要多久？'), send: L('How long will it take?', '这个需要多久？') }] }),
      done(1000),
    ],
    reject: () => [
      at(200, { type: 'message.final', text: L('No problem. Nothing was saved or sent.', '没问题，没有保存或发送任何内容。') }),
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
