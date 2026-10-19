import type { TurnScript } from '../script';
import { s1Confirm, s1Coverage, s1Gaps, s1Upload } from './s1_policy';
import { handoffPreview, s2Compare, s2Needs } from './s2_compare';
import { s3Advance, s3Excluded, s3Explain, s3Prepare, s3Prescreen, s3ReadDoc, s3SubmitDone, s3Validate } from './s3_claim';
import { s4Inject } from './attacks/s4_injection';
import { s5Owner, s5Payout, s5Privilege } from './attacks/s5_overreach';
import { claimAgents, claimFollowup, locationAsk, locationSuggest, partyConnect, s7Finance, s7Medical, s7Overlap, s7Switch } from './s7_more';
import { s7Cover, s7Docs, s7Fix, s7Guarantee, s7Guide, s7Kit, s7Status } from './s7_crossborder';
import { shopCompareAsk, shopCompareResult } from './shop_compare';
import { escalate, fallbackOos, incidentGuide, s6Colloquial, s6Correct } from './s6_handoff';

export const TURNS: TurnScript[] = [
  s1Upload, s1Confirm, s1Coverage, s1Gaps,
  s2Needs, s2Compare, handoffPreview,
  s3Prescreen, s3Excluded, s3Prepare, s3ReadDoc, s3Validate, s3SubmitDone, s3Advance, s3Explain,
  s4Inject, s5Payout, s5Owner, s5Privilege,
  s7Medical, s7Finance, s7Overlap, s7Switch, partyConnect, claimAgents, claimFollowup, locationAsk, locationSuggest,
  s7Cover, s7Guide, s7Guarantee, s7Docs, s7Fix, s7Kit, s7Status,
  shopCompareAsk, shopCompareResult,
  s6Colloquial, s6Correct, incidentGuide, escalate, fallbackOos,
];
export const turnById = (id: string) => TURNS.find((t) => t.id === id)!;
export { fallbackOos };
