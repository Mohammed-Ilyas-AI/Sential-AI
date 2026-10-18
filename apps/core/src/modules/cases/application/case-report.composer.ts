import {
  maskedReference,
  type Case,
  type CaseReportAiSummary,
  type CaseReportSection,
  type CaseReportSource,
  type CustomerContactRecord,
  type DecisionRecord,
  type InstitutionId,
  type Intervention,
  type KillSwitchRecord,
} from '@sentinel/domain';
import type { ArchivedCaseSummary } from '../../investigations/application/ports/case-summary-archive.port.js';

/** The recommendation is the signing analyst's to write; a report cannot be signed off while this remains. */
export const ANALYST_RECOMMENDATION_PLACEHOLDER = '[Analyst to complete before sign-off]';

export interface CaseReportFacts {
  readonly investigationCase: Case;
  /** The account's append-only intervention log as it stands now. */
  readonly interventions: readonly Intervention[];
  readonly contacts: readonly CustomerContactRecord[];
  readonly killSwitches: readonly KillSwitchRecord[];
  /** The decision recorded for the alerting transaction, when there is one. */
  readonly decision: DecisionRecord | null;
  readonly archivedSummary: ArchivedCaseSummary | null;
}

const institutionLabel = (id: string | undefined): string => (id ? id.replace(/^BANK_/, 'Bank ') : 'an unidentified institution');
const sgd = (minor: number): string => `S$${(minor / 100).toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const utc = (iso: string): string => `${iso.slice(0, 10)} ${iso.slice(11, 19)} UTC`;

/** Another institution's party is shown masked (T§14), in the report exactly as in the network view. */
const party = (token: string, institutionId: InstitutionId | undefined, own: InstitutionId): string =>
  institutionId === own ? token : `${institutionLabel(institutionId)} ${maskedReference(token)}`;

const section = (id: CaseReportSection['id'], title: string, lines: readonly string[], sources: readonly CaseReportSource[]): CaseReportSection => ({
  id,
  title,
  body: lines.join('\n'),
  sources,
  edited: false,
});

/**
 * The case report as a rendering of recorded facts (T§4 audit trail, M§5.6): the persisted evidence bundle, the
 * intervention log, recorded contacts and the kill-switch history. Deterministic: the same facts give the same
 * text. The AI summary appears only when a grounded one was already archived, labelled advisory; the report never
 * depends on it, and the recommendation is left for the signing analyst.
 */
export function composeCaseReport(facts: CaseReportFacts): { readonly sections: readonly CaseReportSection[]; readonly aiSummary: CaseReportAiSummary } {
  const { investigationCase, interventions, contacts, killSwitches, decision, archivedSummary } = facts;
  const { evidence } = investigationCase;
  const own = investigationCase.institutionId;
  const account = investigationCase.accountReference ?? investigationCase.accountId;
  const { assessment, drain } = evidence;

  const summary = section(
    'SUMMARY',
    'Summary',
    [
      `Account ${account} at ${institutionLabel(own)} was assessed at ${assessment.score}/100 (${assessment.band}) at ${utc(assessment.evaluatedAt)}.`,
      `Rapid-drain gate SG-RD-50: ${drain.drainPct.toFixed(1)}% of the ${sgd(drain.balanceAtWindowStart)} opening balance moved in 24 hours (${sgd(drain.outflow24h)}); threshold ${drain.thresholdMet ? 'met' : 'not met'}${drain.excluded ? ', payment type excluded' : ''}.`,
      decision
        ? `Recorded decision: ${decision.decision} (${decision.reasonCodes.join(', ')}), policy ${decision.policyVersion}, ruleset ${decision.rulesetVersion}, decided ${utc(decision.decidedAt)}.`
        : 'No decision record was found for the alerting transaction.',
      'The decision was made by the deterministic policy engine. The risk score is advisory; the gate decides.',
    ],
    [
      { field: 'assessment.score', value: String(assessment.score) },
      { field: 'assessment.band', value: assessment.band },
      { field: 'drain.drainPct', value: drain.drainPct.toFixed(1) },
      { field: 'drain.thresholdMet', value: String(drain.thresholdMet) },
      ...(decision ? [{ field: 'decision.decision', value: decision.decision }, { field: 'decision.policyVersion', value: decision.policyVersion }] : []),
    ],
  );

  const timelineEntries: { readonly at: string; readonly text: string }[] = [
    ...evidence.deviceHistory.map((event) => ({ at: event.occurredAt, text: `${event.eventType.replaceAll('_', ' ').toLowerCase()} on device ${event.deviceId}` })),
    ...evidence.payeeHistory.map((event) => ({ at: event.occurredAt, text: `payee ${event.payeeId} added` })),
    ...evidence.recentTransactions
      .filter((transaction) => transaction.sourceAccountId === investigationCase.accountId)
      .map((transaction) => ({
        at: transaction.ts,
        text: `${transaction.type.toLowerCase()} of ${sgd(transaction.amount)} to ${party(transaction.destAccountId, transaction.destInstitutionId, own)} (${transaction.id})`,
      })),
    ...interventions.map((record) => ({
      at: record.actedAt,
      text: `intervention ${record.previousState} -> ${record.state} by ${record.actorIdentity ?? record.actor} on ${record.transactionId} (${record.reasonCodes.join(', ')})`,
    })),
    ...contacts.map((contact) => ({
      at: contact.recordedAt,
      text: `customer contact by ${contact.actorIdentity}: ${contact.channel} ${contact.outcome} (simulated channel)`,
    })),
    ...killSwitches.map((record) => ({ at: record.actedAt, text: `kill switch ${record.state} by ${record.actorIdentity ?? record.actor}` })),
  ].sort((left, right) => left.at.localeCompare(right.at) || left.text.localeCompare(right.text));
  const timeline = section(
    'TIMELINE',
    'Timeline',
    timelineEntries.length ? timelineEntries.map((entry) => `${utc(entry.at)}  ${entry.text}`) : ['No timeline events were recorded.'],
    [
      { field: 'deviceHistory', value: `${evidence.deviceHistory.length} events` },
      { field: 'payeeHistory', value: `${evidence.payeeHistory.length} events` },
      { field: 'recentTransactions', value: `${evidence.recentTransactions.length} transactions` },
      { field: 'interventions', value: `${interventions.length} records` },
    ],
  );

  const evidenceSection = section(
    'EVIDENCE',
    'Risk evidence',
    assessment.contributions.length
      ? assessment.contributions.map((contribution) => `${contribution.label} (${contribution.code}): ${contribution.points} points. ${contribution.detail}`)
      : ['No rule contributed to the score.'],
    assessment.contributions.map((contribution, index) => ({ field: `assessment.contributions[${index}].points`, value: String(contribution.points) })),
  );

  const interventionLines = [
    ...interventions.map(
      (record) =>
        `${utc(record.actedAt)}  ${record.transactionId}: ${record.previousState} -> ${record.state} by ${record.actorIdentity ?? record.actor}; ${record.reasonCodes.join(', ')}${record.holdUntil ? `; hold until ${utc(record.holdUntil)}` : ''}.`,
    ),
    ...killSwitches.map((record) => `${utc(record.actedAt)}  Kill switch ${record.state} by ${record.actorIdentity ?? record.actor}.`),
    ...contacts.map((contact) => `${utc(contact.recordedAt)}  Customer contact (${contact.channel}, simulated): ${contact.outcome}.`),
  ];
  const interventionSection = section(
    'INTERVENTIONS',
    'Interventions and customer contact',
    interventionLines.length ? interventionLines : ['No intervention, kill switch or customer contact was recorded.'],
    [
      { field: 'interventions', value: `${interventions.length} records` },
      { field: 'customerContacts', value: `${contacts.length} attempts` },
      { field: 'killSwitch', value: `${killSwitches.length} records` },
    ],
  );

  const { neighbourhood } = evidence;
  const nodeById = new Map(neighbourhood.nodes.map((node) => [node.id, node]));
  const flagged = neighbourhood.nodes.filter((node) => node.flagged);
  const networkSection = section(
    'NETWORK',
    'Network relationships',
    [
      `Observed neighbourhood: ${neighbourhood.nodes.length} entities and ${neighbourhood.edges.length} relationships within ${neighbourhood.hopDepth} hops${neighbourhood.truncated ? ' (capped; lighter relationships omitted)' : ''}.`,
      ...flagged.map((node) => `Flagged ${node.kind.toLowerCase()} ${party(node.id, node.institutionId, own)}: ${node.riskIndicators.join(', ') || 'no indicator recorded'}.`),
      ...neighbourhood.edges.map((edge) => {
        const target = nodeById.get(edge.to);
        return `${edge.kind} to ${party(edge.to, target?.institutionId, own)}: ${edge.evidence.linkage} linkage reported by ${institutionLabel(edge.evidence.sourceInstitution)}, observed ${utc(edge.evidence.observedAt)}.`;
      }),
      'Relationships are those observed by participating institutions; activity beyond them is not visible to the network.',
    ],
    [
      { field: 'neighbourhood.nodes', value: String(neighbourhood.nodes.length) },
      { field: 'neighbourhood.edges', value: String(neighbourhood.edges.length) },
      { field: 'neighbourhood.truncated', value: String(neighbourhood.truncated) },
    ],
  );

  const aiSummary: CaseReportAiSummary = archivedSummary
    ? { status: 'INCLUDED', hypothesis: archivedSummary.summary.hypothesis, confidence: archivedSummary.summary.confidence, archivedAt: archivedSummary.archivedAt }
    : { status: 'NOT_AVAILABLE' };
  const recommendation = section(
    'RECOMMENDATION',
    'Recommendation',
    [
      ...(archivedSummary
        ? [
            `AI advisory (Gemini, grounded in the evidence bundle; ${archivedSummary.summary.confidence} confidence): ${archivedSummary.summary.hypothesis}`,
            ...archivedSummary.summary.recommendedActions.map((action) => `Advisory action: ${action}`),
          ]
        : ['No AI case summary had been generated for this assessment; the report rests on the recorded facts above.']),
      `Analyst recommendation: ${ANALYST_RECOMMENDATION_PLACEHOLDER}`,
    ],
    archivedSummary ? archivedSummary.summary.evidence.map((claim) => ({ field: claim.sourceField, value: claim.value })) : [],
  );

  return { sections: [summary, timeline, evidenceSection, interventionSection, networkSection, recommendation], aiSummary };
}
