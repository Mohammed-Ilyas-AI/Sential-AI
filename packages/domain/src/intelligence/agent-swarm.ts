export interface AtoAgentFinding {
  readonly isTakeoverLikely: boolean;
  readonly deviceRisk: 'KNOWN' | 'SUSPICIOUS' | 'UNSEEN_COMPROMISED';
  readonly authenticationLineage: string;
  readonly atoConfidenceScore: number;
}

export interface BeneficiaryAgentFinding {
  readonly payeeRiskTier: 'BENIGN_BILLER' | 'ESTABLISHED' | 'NEW_HIGH_RISK' | 'KNOWN_MULE';
  readonly dormantPayeeActivated: boolean;
  readonly counterpartyAssessment: string;
}

export interface ScamIntentAgentFinding {
  readonly scamTypology: 'GOVERNMENT_IMPERSONATION' | 'INVESTMENT_SCAM' | 'JOB_SCAM' | 'UNKNOWN_DRAIN';
  readonly coercionIndex: 'LOW' | 'MEDIUM' | 'ACUTE_COERCION';
  readonly behavioralAnomalySummary: string;
}

export interface MuleTraceAgentFinding {
  readonly observedHops: number;
  readonly identifiedMuleRing: boolean;
  readonly pathEntities: readonly string[];
  readonly observabilityStopReason: string;
}

export interface CustomerVerificationAgentFinding {
  readonly channelUsed: 'AUTOMATED_CALL' | 'SECURE_PUSH' | 'EMAIL';
  readonly callOutcome: 'NO_ANSWER' | 'VERIFIED_GENUINE' | 'COERCION_CONFIRMED' | 'CALL_DROPPED';
  readonly recommendedImmediateAction: 'KILL_SWITCH' | 'RELEASE_HOLD' | 'RETRY_CONTACT';
  readonly verificationScript: string;
}

export interface RecoveryRecallAgentFinding {
  readonly killSwitchEngaged: boolean;
  readonly cascadedHoldsPlaced: number;
  readonly interbankRecallStatus: 'DISPATCHED_TO_BANK_B' | 'PENDING_ANALYST' | 'NOT_APPLICABLE';
  readonly estimatedSalvagedMinorUnits: number;
}

export interface CaseReportingAgentFinding {
  readonly reportVersion: number;
  readonly executiveSummary: string;
  readonly cadReportDossier: string;
  readonly isReadyForSignOff: boolean;
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

