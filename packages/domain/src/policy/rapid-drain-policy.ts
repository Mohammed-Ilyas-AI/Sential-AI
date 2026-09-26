import type { MinorUnits } from '../money/minor-units.js';

/** Configuration, never hardcoded in detection code. Changing any value requires a new policyVersion. */
export interface RapidDrainPolicy {
  readonly policyVersion: string;
  readonly protectedBalance: MinorUnits;
  readonly gatePercent: number;
  readonly windowHours: number;
  readonly holdHours: number;
}
