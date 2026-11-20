/**
 * The 7-agent swarm (M§8.8): seven specialist agents that work one case from its evidence bundle, in four stages.
 * As built they are deterministic: each finding is derived from the bundle with fixed rules, no model is called,
 * and nothing here changes a score, a decision, a hold or a kill switch. Agents recommend; the analyst acts.
 */
export interface AtoAgentFinding {
  readonly isTakeoverLikely: boolean;
  readonly deviceRisk: 'KNOWN' | 'SUSPICIOUS' | 'UNSEEN_COMPROMISED';
  readonly authenticationLineage: string;
  /** The rule points behind the finding: NEW_DEVICE + COOLING_OFF + NEW_PAYEE contributions. */
  readonly atoSignalPoints: number;
}

export interface BeneficiaryAgentFinding {
  readonly payeeRiskTier: 'BENIGN_BILLER' | 'ESTABLISHED' | 'NEW_HIGH_RISK' | 'FLAGGED_NEIGHBOURHOOD';
  readonly dormantPayeeActivated: boolean;
  readonly counterpartyAssessment: string;
}

/** The reference's four scenario patterns (docs/reference: phishing, mule, smurf, replay), matched from signals. */
export type ScamPattern = 'ACCOUNT_TAKEOVER' | 'CREDENTIAL_REPLAY' | 'MULE_FORWARDING' | 'SMURFING' | 'UNCLASSIFIED';

export interface ScamIntentAgentFinding {
  readonly scamTypology: ScamPattern;
  /** How hard the money is moving: drain against the gate and velocity against the account's baseline. */
  readonly outflowPressure: 'LOW' | 'MEDIUM' | 'ACUTE';
  readonly behavioralAnomalySummary: string;
}

export interface MuleTraceAgentFinding {
  readonly observedHops: number;
  /** Flagged entities are recorded within two hops of the payee (ENTITY_LINK). */
  readonly flaggedNeighbourhood: boolean;
  /** Tokens from the case's recorded neighbourhood; never an invented node. */
  readonly pathEntities: readonly string[];
  readonly observabilityStopReason: string;
}

export interface CustomerVerificationAgentFinding {
  readonly proposedChannel: 'AUTOMATED_CALL' | 'SECURE_PUSH' | 'EMAIL';
  /** An agent never recommends releasing a hold: only the customer's verification with the bank does. */
  readonly recommendedImmediateAction: 'KILL_SWITCH' | 'RETRY_CONTACT' | 'MONITOR';
  readonly verificationScript: string;
}

export interface RecoveryRecallAgentFinding {
  /** Proposed to the analyst, who approves or declines it; never applied by the agent. */
  readonly killSwitchRecommended: boolean;
  /** Transfers the gate has held on this account, from the recorded interventions. */
  readonly heldTransfers: number;
  readonly recallRecommendation: 'RECOMMENDED' | 'NOT_APPLICABLE';
  /** The amount those held transfers kept in the account. */
  readonly heldMinorUnits: number;
}

export interface CaseReportingAgentFinding {
  readonly reportVersion: number;
  readonly executiveSummary: string;
  /** A draft for the analyst to review, edit and sign off in the case report; nothing is filed. */
  readonly draftSummary: string;
  readonly readyForAnalystReview: boolean;
}

export interface SentinelSwarmReport {
  readonly assessmentId: string;
  readonly evaluatedAt: string;
  readonly overallThreatLevel: 'LOW' | 'ELEVATED' | 'CRITICAL';
  readonly agents: {
    readonly ato: AtoAgentFinding;
    readonly beneficiary: BeneficiaryAgentFinding;
    readonly scamIntent: ScamIntentAgentFinding;
    readonly muleTrace: MuleTraceAgentFinding;
    readonly verification: CustomerVerificationAgentFinding;
    readonly recovery: RecoveryRecallAgentFinding;
    readonly reporting: CaseReportingAgentFinding;
  };
}
