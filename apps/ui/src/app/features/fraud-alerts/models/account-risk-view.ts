import type { MinorUnits, RiskBand } from '@sentinel/domain';

/** The numbers that drive the policy gate, not a generic profile (M§5.2). */
export interface AccountRiskView {
  readonly accountId: string;
  readonly balanceAtWindowStart: MinorUnits;
  readonly transferredLast24h: MinorUnits;
  readonly drainPct: number;
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
