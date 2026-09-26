import type { RiskBand } from '../risk/risk-assessment.js';
import type { IsoTimestamp } from '../time/iso-timestamp.js';

export type AlertStatus = 'OPEN' | 'CLOSED';

/** One open alert per account, promoted as the account's risk rises. */
export interface Alert {
  readonly id: string;
  readonly accountId: string;
  readonly accountReference?: string;
  readonly transactionId: string;
  readonly assessmentId: string;
  readonly score: number;
  readonly band: RiskBand;
  readonly onHold: boolean;
  readonly status: AlertStatus;
  readonly raisedAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}
