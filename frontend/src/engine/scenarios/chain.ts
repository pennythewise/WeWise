import { L } from '../l';
import { at, cid, tool, type TimedEvent } from '../script';
import type { ChainProofKind } from '../types';

/** Scripted on-chain proofs for the S1–S7 simulations. Values are fixed so replays are identical; the live backend computes real ones. */
export const SIM_NETWORK = 'FISCO BCOS · group0';
export const SIM_CONTRACT = '0xcc8321d6375c494d043fdd0260f21bc0ec51dacc';

interface ProofSpec { kind: ChainProofKind; block: number; root: string; tx: string; anchoredAt: string; title: L; items: L[] }

export const SIM_PROOFS = {
  s1: { kind: 'consent', block: 1288, anchoredAt: '2026-10-14 09:12',
    root: 'dc7b6b7339685af799ab12a65867d82a33dd3e58e0c2d20fa584ffef2fbdc369', tx: '0x1afcdb8e9957aebe4d6f1b76e6727521dda0ff3260c61f3eab7b3393a025aebd',
    title: L('Your consent to keep this policy is on record', '您保存此保单的授权已上链存证'),
    items: [L('Purpose: keep the policy until you delete it', '用途：保存保单，直至您删除'), L('Your confirmed fields (fingerprint only)', '您已确认的字段（仅指纹）')] },
  s2: { kind: 'consent', block: 1291, anchoredAt: '2026-10-14 10:03',
    root: '15042c7e88f8e60fc31b3eaae33ae7e1cafc894e9f8435e3471ccabcc356b47e', tx: '0x82463708d109043caad37623b401637f77de48ff0d41d180230daae2bf174fc2',
    title: L('Your sharing consent is on record', '您的分享授权已上链存证'),
    items: [L('Shared with: Daniel Chen, licensed agent', '分享对象：陈大伟，持牌顾问'), L('Items: name, phone, needs, comparison (masked)', '内容：姓名、电话、需求、对比（已脱敏）')] },
  s3: { kind: 'claim_package', block: 1304, anchoredAt: '2026-10-14 11:40',
    root: '5fc8ffe6495e6082799baf666caf252101d6c71f28d8e6a059c5120a2a4a23c8', tx: '0x007f81e6b7979c1524bfd163c8fe572e0a7368ac612545e3782247384adbbb6a',
    title: L('Claim kit fingerprinted on-chain', '理赔资料包指纹已上链'),
    items: [L('English summary', '英文摘要'), L('Thai bill and discharge note (originals)', '泰文账单和出院小结（原件）'), L('Translations', '译文'), L('Pre-filled claim form', '预填理赔表格')] },
  s4: { kind: 'claim_package', block: 1297, anchoredAt: '2026-10-14 10:58',
    root: 'a05241bb5f4150031a27a0d874627badffa5000e51090988e1f32b23e86f5022', tx: '0x5e6fabdcc15a2389a95339b6ed1f887648c8493087785c20e086cdc52947c6c1',
    title: L('Claim package fingerprinted on-chain', '理赔材料包指纹已上链'),
    items: [L('Claim form', '理赔申请表'), L('Identity document (masked)', '身份证明（已脱敏）'), L('Discharge summary', '出院小结'), L('Itemised bill', '费用明细账单')] },
  s5: { kind: 'audit_batch', block: 1301, anchoredAt: '2026-10-14 11:16',
    root: 'ca53469722f117fdb35ea3aec6c57299ad05af3bd139e3a2f1364134bdd36890', tx: '0xefdc5651be7c97494ea7fd22d1e5abbb891a6542ab0b68dad300741439f0849b',
    title: L('The blocked attempt is sealed in the audit log', '被拦截的操作已封存进审计日志'),
    items: [L('Hidden instruction flagged on page 3', '第 3 页隐藏指令已标记'), L('Payout account change blocked (INTENT_MISMATCH)', '修改赔款账户已拦截（INTENT_MISMATCH）')] },
  s6: { kind: 'audit_batch', block: 1302, anchoredAt: '2026-10-14 11:21',
    root: 'd0e5b1791dfabb40366f8e6756b8ded519c746c1d770a4108cd80cddfb9b3e48', tx: '0xd4d72391d112231d9fdf0c8851ad41c825cab07c2747b6b1f37e3dcedd831b96',
    title: L('This refusal is sealed in the audit log', '这次拒绝已封存进审计日志'),
    items: [L('Payout account change requested in chat', '聊天中请求修改赔款账户'), L('Blocked by the policy enforcement point (T4)', '被策略执行点拦截（T4）')] },
} satisfies Record<string, ProofSpec>;

const TOOL: Record<ChainProofKind, string> = { claim_package: 'proof_anchor_package', consent: 'proof_anchor_consent', audit_batch: 'proof_seal_audit' };

/** Anchor tool call + proof card. Only a salted reference and a Merkle root go on-chain. */
export function anchorEvents(t0: number, p: ProofSpec, cardAt = t0 + 220): TimedEvent[] {
  return [
    ...tool(t0, TOOL[p.kind], 'T1', { kind: p.kind, leaves: p.items.length, on_chain: 'salted_ref + merkle_root', pii_on_chain: false }, L(`Anchored at block #${p.block}`, `已在区块 #${p.block} 存证`), 180),
    at(cardAt, { type: 'ui.card', card: { kind: 'ChainProofCard', id: cid('proof'), data: { proofKind: p.kind, network: SIM_NETWORK, contract: SIM_CONTRACT, block: p.block, txHash: p.tx, root: p.root, anchoredAt: p.anchoredAt, title: p.title, items: p.items, simulated: true } } }),
  ];
}
