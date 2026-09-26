import { DECISION_REASON, type DecisionRecord, type DrainExclusionReason, type MinorUnits, type RiskBand } from '@sentinel/domain';

/** The numbers that drive the policy gate, not a generic profile (M§5.2). */
export interface AccountRiskView {
  readonly accountId: string;
  readonly accountReference?: string;
  readonly balanceAtWindowStart: MinorUnits;
  readonly transferredLast24h: MinorUnits;
  readonly drainPct: number;
  /** Whether the balance at window start put the account under the rapid-drain control. */
  readonly protectedAccount: boolean;
  readonly thresholdMet: boolean;
  readonly exclusionReason?: DrainExclusionReason;
  readonly score: number;
  readonly band: RiskBand;
  readonly signals: {
    readonly newDevice: boolean;
    readonly newPayee: boolean;
    readonly velocityAnomaly: boolean;
    readonly coolingOffActive: boolean;
    readonly destinationPreviouslyFlagged: boolean;
  };
}

/** Read straight from the decision the gate wrote; the UI recomputes neither the drain nor the score. */
export function toAccountRiskView(decision: DecisionRecord): AccountRiskView {
  const { drain, contributions } = decision.assessment;
  const fired = new Set(contributions.map((contribution) => contribution.code));
  return {
    accountId: decision.accountId,
    ...(decision.accountReference ? { accountReference: decision.accountReference } : {}),
    balanceAtWindowStart: drain.balanceAtWindowStart,
    transferredLast24h: drain.outflow24h,
    drainPct: drain.drainPct,
    protectedAccount: !decision.reasonCodes.includes(DECISION_REASON.notProtected),
    thresholdMet: drain.thresholdMet,
    ...(drain.exclusionReason ? { exclusionReason: drain.exclusionReason } : {}),
    score: decision.riskScore,
    band: decision.band,
    signals: {
      newDevice: fired.has('NEW_DEVICE'),
      newPayee: fired.has('NEW_PAYEE'),
      velocityAnomaly: fired.has('VELOCITY'),
      coolingOffActive: fired.has('COOLING_OFF'),
      destinationPreviouslyFlagged: fired.has('ENTITY_LINK'),
    },
  };
}
