import type { Card } from '@/engine/types';
import { AdvocateCard } from './AdvocateCard';
import { ChecklistCard } from './ChecklistCard';
import { ClaimPrescreenCard } from './ClaimPrescreenCard';
import { ClaimStatusCard } from './ClaimStatusCard';
import { CompareTableCard } from './CompareTableCard';
import { ConfirmActionCard } from './ConfirmActionCard';
import { EscalationCard } from './EscalationCard';
import { ExtractionReviewCard } from './ExtractionReviewCard';
import { GapReportCard } from './GapReportCard';
import { HandoffPreviewCard } from './HandoffPreviewCard';
import { IncidentGuideCard } from './IncidentGuideCard';
import { PolicySummaryCard } from './PolicySummaryCard';
import { SafetyNoticeCard } from './SafetyNoticeCard';
import { VerdictCard } from './VerdictCard';
import { ReportInsightsCard } from './ReportInsightsCard';
import { OverlapReportCard } from './OverlapReportCard';
import { SwitchCheckCard } from '../switch/SwitchCheck';
import { LocationPermissionCard, LocationSuggestCard } from '../location/LocationCards';

/** Exhaustive switch over the card union: adding a card kind without a renderer fails to compile. */
export function CardView({ card, messageId }: { card: Card; messageId?: string }) {
  switch (card.kind) {
    case 'PolicySummaryCard': return <PolicySummaryCard {...card.data} />;
    case 'ExtractionReviewCard': return <ExtractionReviewCard {...card.data} />;
    case 'GapReportCard': return <GapReportCard {...card.data} messageId={messageId} />;
    case 'CompareTableCard': return <CompareTableCard {...card.data} />;
    case 'AdvocateCard': return <AdvocateCard {...card.data} />;
    case 'VerdictCard': return <VerdictCard {...card.data} />;
    case 'ClaimPrescreenCard': return <ClaimPrescreenCard {...card.data} messageId={messageId} />;
    case 'ChecklistCard': return <ChecklistCard {...card.data} />;
    case 'ClaimStatusCard': return <ClaimStatusCard {...card.data} />;
    case 'ConfirmActionCard': return <ConfirmActionCard {...card.data} />;
    case 'HandoffPreviewCard': return <HandoffPreviewCard {...card.data} />;
    case 'IncidentGuideCard': return <IncidentGuideCard {...card.data} messageId={messageId} />;
    case 'SafetyNoticeCard': return <SafetyNoticeCard {...card.data} />;
    case 'EscalationCard': return <EscalationCard {...card.data} />;
    case 'ReportInsightsCard': return <ReportInsightsCard {...card.data} messageId={messageId} />;
    case 'OverlapReportCard': return <OverlapReportCard gig={card.data.gig} messageId={messageId} />;
    case 'SwitchCheckCard': return <SwitchCheckCard />;
    case 'LocationPermissionCard': return <LocationPermissionCard />;
    case 'LocationSuggestCard': return <LocationSuggestCard cityId={card.data.cityId} messageId={messageId} />;
  }
}
