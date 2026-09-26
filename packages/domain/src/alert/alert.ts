import type { RiskBand } from '../risk/risk-assessment.js';
import type { IsoTimestamp } from '../time/iso-timestamp.js';

export type AlertStatus = 'OPEN' | 'CLOSED';

export interface Alert {
  readonly id: string;
  readonly accountId: string;
  readonly transactionId: string;
  readonly assessmentId: string;
  readonly score: number;
  readonly band: RiskBand;
  readonly status: AlertStatus;
  readonly raisedAt: IsoTimestamp;
}
