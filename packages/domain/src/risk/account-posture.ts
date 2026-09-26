import type { IsoTimestamp } from '../time/iso-timestamp.js';
import type { Contribution } from './contribution.js';
import type { RiskBand } from './risk-assessment.js';

/**
 * The account's current risk with no transaction in flight, re-evaluated after a security event (the HTML
 * reference's score climb: new device 21, new payee 37). Advisory only; never persisted as an assessment.
 */
export interface AccountPosture {
  readonly accountId: string;
  readonly score: number;
  readonly band: RiskBand;
  readonly contributions: readonly Contribution[];
  readonly evaluatedAt: IsoTimestamp;
}
