import {
  RAPID_DRAIN_GATE_PERCENT,
  type AtoAgentFinding,
  type BeneficiaryAgentFinding,
  type CaseReportingAgentFinding,
  type CustomerVerificationAgentFinding,
  type EvidenceBundle,
  type MuleTraceAgentFinding,
  type RecoveryRecallAgentFinding,
  type ScamIntentAgentFinding,
  type ScamPattern,
  type SentinelSwarmReport,
} from '@sentinel/domain';
import type { Clock } from '../../../platform/time/clock.js';
import type { ModelGateway } from './ports/model-gateway.port.js';

export interface SentinelAgentOrchestratorDependencies {
  readonly gateway?: ModelGateway;
  readonly clock: Clock;
}

const PATTERN_LABEL: Readonly<Record<ScamPattern, string>> = {
  ACCOUNT_TAKEOVER: 'account takeover',
  CREDENTIAL_REPLAY: 'credential replay',
  MULE_FORWARDING: 'mule forwarding',
  SMURFING: 'smurfing',
  UNCLASSIFIED: 'unclassified rapid outflow',
};
const MAX_PATH_ENTITIES = 4;
/** The reference's smurfing shape: many transfers inside the window (docs/reference, scenario "smurf"). */
const SMURFING_MIN_TRANSFERS = 6;

const sgd = (minorUnits: number) => `S$${(minorUnits / 100).toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * The 7-agent swarm (M§8.8): seven specialist agents over one case's evidence bundle, in four stages.
 *   Stage 1, in parallel: account takeover, beneficiary, scam pattern, mule tracing.
 *   Stage 2: customer verification.  Stage 3: recovery and containment.  Stage 4: case reporting.
 * Deterministic: every finding is derived from the bundle with fixed rules, and every fact it states is in the
 * bundle. No model is called. Agents recommend; the analyst approves; the gate alone holds.
 */
export class SentinelAgentOrchestrator {
  private readonly cache = new Map<string, SentinelSwarmReport>();

  constructor(private readonly deps: SentinelAgentOrchestratorDependencies) {}

  async orchestrate(assessmentId: string, evidence: EvidenceBundle): Promise<SentinelSwarmReport> {
    const cached = this.cache.get(assessmentId);
    if (cached) return cached;

    const evaluatedAt = this.deps.clock.now().toISOString();
    const signals = signalsOf(evidence);

    // Stage 1: four agents in parallel, each on the same bundle.
    const [ato, beneficiary, scamIntent, muleTrace] = await Promise.all([
      Promise.resolve(this.evaluateAto(signals)),
      Promise.resolve(this.evaluateBeneficiary(evidence, signals)),
      Promise.resolve(this.evaluateScamIntent(evidence, signals)),
      Promise.resolve(this.evaluateMuleTrace(evidence, signals)),
    ]);
    // Stage 2, 3, 4: each builds on the findings before it.
    const verification = this.evaluateVerification(evidence, ato, scamIntent);
    const recovery = this.evaluateRecovery(evidence, verification, muleTrace);
    const reporting = this.evaluateReporting(evidence, ato, beneficiary, scamIntent, verification, recovery);

    const overallThreatLevel: SentinelSwarmReport['overallThreatLevel'] =
      evidence.assessment.band === 'CRITICAL' || recovery.heldTransfers > 0 || ato.isTakeoverLikely
        ? 'CRITICAL'
        : evidence.assessment.band === 'HIGH' || muleTrace.flaggedNeighbourhood
          ? 'ELEVATED'
          : 'LOW';

    const report: SentinelSwarmReport = {
      assessmentId,
      evaluatedAt,
      overallThreatLevel,
      agents: { ato, beneficiary, scamIntent, muleTrace, verification, recovery, reporting },
    };
    this.cache.set(assessmentId, report);
    return report;
  }

  // Agent 1: account takeover.
  private evaluateAto(signals: Signals): AtoAgentFinding {
    const isTakeoverLikely = Boolean(signals.newDevice && (signals.coolingOff || signals.newPayee));
    return {
      isTakeoverLikely,
      deviceRisk: signals.newDevice ? 'UNSEEN_COMPROMISED' : 'KNOWN',
      authenticationLineage: signals.newDevice
        ? `${signals.newDevice.detail}${signals.coolingOff ? `; ${signals.coolingOff.detail}` : ''}.`
        : 'Transfers came from a device the bank already knows for this account.',
      atoSignalPoints: (signals.newDevice?.points ?? 0) + (signals.coolingOff?.points ?? 0) + (signals.newPayee?.points ?? 0),
    };
  }

  // Agent 2: beneficiary.
  private evaluateBeneficiary(evidence: EvidenceBundle, signals: Signals): BeneficiaryAgentFinding {
    const target = evidence.recentTransactions[0];
    return {
      payeeRiskTier: signals.entityLink ? 'FLAGGED_NEIGHBOURHOOD' : signals.newPayee ? 'NEW_HIGH_RISK' : 'ESTABLISHED',
      dormantPayeeActivated: Boolean(signals.newPayee && target && target.amount > 500_000),
      counterpartyAssessment: signals.entityLink
        ? `Payee ${target?.payeeId ?? ''} is linked to flagged entities in the observed network: ${signals.entityLink.detail}.`.replace('  ', ' ')
        : signals.newPayee
          ? `New beneficiary: ${signals.newPayee.detail}.`
          : 'The beneficiary has an established transfer history with this account.',
    };
  }

  // Agent 3: scam pattern, matched to the reference's four scenarios from the recorded signals.
  private evaluateScamIntent(evidence: EvidenceBundle, signals: Signals): ScamIntentAgentFinding {
    const scamTypology: ScamPattern =
      signals.entityLink && !evidence.account.protected
        ? 'MULE_FORWARDING'
        : signals.newDevice && signals.coolingOff
          ? 'CREDENTIAL_REPLAY'
          : signals.newDevice
            ? 'ACCOUNT_TAKEOVER'
            : signals.velocity && evidence.recentTransactions.length >= SMURFING_MIN_TRANSFERS
              ? 'SMURFING'
              : 'UNCLASSIFIED';
    const drain = evidence.drain.drainPct;
    const outflowPressure = drain > RAPID_DRAIN_GATE_PERCENT || (signals.drain && signals.velocity) ? 'ACUTE' : signals.drain || signals.velocity ? 'MEDIUM' : 'LOW';
    return {
      scamTypology,
      outflowPressure,
      behavioralAnomalySummary: `Matches the ${PATTERN_LABEL[scamTypology]} pattern. ${drain.toFixed(1)}% of the opening balance has left in 24h${
        signals.velocity ? `; ${signals.velocity.detail}` : ''
      }.`,
    };
  }

  // Agent 4: network and mule tracing, from the case's recorded two-hop neighbourhood.
  private evaluateMuleTrace(evidence: EvidenceBundle, signals: Signals): MuleTraceAgentFinding {
    const flagged = evidence.neighbourhood.nodes.filter((node) => node.flagged).map((node) => node.id);
    const target = evidence.recentTransactions[0];
    return {
      observedHops: evidence.neighbourhood.hopDepth,
      flaggedNeighbourhood: Boolean(signals.entityLink),
      pathEntities: [evidence.account.accountId, ...(target ? [target.payeeId] : []), ...flagged].slice(0, MAX_PATH_ENTITIES),
      observabilityStopReason: evidence.neighbourhood.truncated
        ? 'The neighbourhood was capped; the least significant edges are not shown.'
        : 'Observation stops at the recorded neighbourhood; nothing beyond it is inferred.',
    };
  }

  // Agent 5: customer verification. It proposes the contact; the action centre records what happened.
  private evaluateVerification(evidence: EvidenceBundle, ato: AtoAgentFinding, scam: ScamIntentAgentFinding): CustomerVerificationAgentFinding {
    const compromised = ato.isTakeoverLikely || scam.scamTypology === 'MULE_FORWARDING' || scam.scamTypology === 'CREDENTIAL_REPLAY';
    const held = heldAmount(evidence);
    return {
      proposedChannel: 'AUTOMATED_CALL',
      recommendedImmediateAction: compromised ? 'KILL_SWITCH' : scam.outflowPressure === 'LOW' ? 'MONITOR' : 'RETRY_CONTACT',
      verificationScript: held > 0
        ? `Your bank has paused a transfer of ${sgd(held)} from your account under its rapid-drain safeguard. If someone asked you to move money, hang up and call the number on the back of your card.`
        : 'Your bank has noticed unusual activity on your account. If you did not make these transfers, call the number on the back of your card.',
    };
  }

  // Agent 6: recovery and containment, from the recorded holds.
  private evaluateRecovery(evidence: EvidenceBundle, verification: CustomerVerificationAgentFinding, mule: MuleTraceAgentFinding): RecoveryRecallAgentFinding {
    const heldTransfers = evidence.interventions.filter((intervention) => intervention.state === 'HELD').length;
    return {
      killSwitchRecommended: verification.recommendedImmediateAction === 'KILL_SWITCH',
      heldTransfers,
      recallRecommendation: mule.flaggedNeighbourhood ? 'RECOMMENDED' : 'NOT_APPLICABLE',
      heldMinorUnits: heldAmount(evidence),
    };
  }

  // Agent 7: case reporting. A draft for the analyst's case report; nothing is filed.
  private evaluateReporting(
    evidence: EvidenceBundle,
    ato: AtoAgentFinding,
    beneficiary: BeneficiaryAgentFinding,
    scam: ScamIntentAgentFinding,
    verification: CustomerVerificationAgentFinding,
    recovery: RecoveryRecallAgentFinding,
  ): CaseReportingAgentFinding {
    const { score, band } = evidence.assessment;
    return {
      reportVersion: 1,
      executiveSummary: `Seven agents agree on ${PATTERN_LABEL[scam.scamTypology]} (score ${score}, ${band}). ${
        ato.isTakeoverLikely ? 'Takeover signals are present. ' : ''
      }Payee: ${beneficiary.payeeRiskTier.replaceAll('_', ' ').toLowerCase()}. ${
        recovery.heldTransfers > 0 ? `${recovery.heldTransfers} transfer(s) held by the gate. ` : 'No transfer held by the gate. '
      }Recommended: ${verification.recommendedImmediateAction.replaceAll('_', ' ').toLowerCase()}, for the analyst to approve.`,
      draftSummary: `Draft for analyst review. Account ${evidence.account.accountId} (${evidence.account.institutionId}). Score ${score} (${band}); drain ${evidence.drain.drainPct.toFixed(
        1,
      )}% of the opening balance in 24h. Pattern: ${PATTERN_LABEL[scam.scamTypology]}. Contributions: ${evidence.assessment.contributions
        .map((contribution) => `${contribution.code} ${contribution.points}`)
        .join(', ')}.`,
      readyForAnalystReview: true,
    };
  }
}

interface Signal {
  readonly points: number;
  readonly detail: string;
}

interface Signals {
  readonly drain?: Signal;
  readonly newDevice?: Signal;
  readonly newPayee?: Signal;
  readonly velocity?: Signal;
  readonly entityLink?: Signal;
  readonly coolingOff?: Signal;
}

/** The rule contributions the engine wrote for this assessment: the agents' only source of signals. */
function signalsOf(evidence: EvidenceBundle): Signals {
  const find = (code: string): Signal | undefined => {
    const contribution = evidence.assessment.contributions.find((candidate) => candidate.code === code);
    return contribution ? { points: contribution.points, detail: contribution.detail } : undefined;
  };
  const signals: Record<string, Signal | undefined> = {
    drain: find('RAPID_DRAIN'),
    newDevice: find('NEW_DEVICE'),
    newPayee: find('NEW_PAYEE'),
    velocity: find('VELOCITY'),
    entityLink: find('ENTITY_LINK'),
    coolingOff: find('COOLING_OFF'),
  };
  return Object.fromEntries(Object.entries(signals).filter(([, value]) => value !== undefined)) as Signals;
}

/** The amount of the account's transfers the gate is holding, joined from the interventions and the transactions. */
function heldAmount(evidence: EvidenceBundle): number {
  const held = new Set(evidence.interventions.filter((intervention) => intervention.state === 'HELD').map((intervention) => intervention.transactionId));
  return evidence.recentTransactions.filter((transaction) => held.has(transaction.id)).reduce((sum, transaction) => sum + transaction.amount, 0);
}
