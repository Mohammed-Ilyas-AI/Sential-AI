import type { AdvisoryOutcome, Decision, InterventionState, RiskBand } from '@sentinel/domain';

export type RequestStatus = 'IDLE' | 'LOADING' | 'READY' | 'FAILED';

/**
 * One advisory request as the workspace shows it. A FALLBACK outcome is not a failure: the deterministic
 * attribution is rendered regardless, and the analyst loses the narrative, never the protection.
 */
export interface AdvisoryState<TAdvisory> {
  readonly status: RequestStatus;
  readonly outcome: AdvisoryOutcome<TAdvisory> | null;
}

export interface TimelineEntry {
  readonly at: string;
  readonly kind: 'TRANSFER' | 'INTERVENTION' | 'DEVICE' | 'PAYEE';
  readonly title: string;
  readonly detail: string;
  /** Minor units, for transfers only. */
  readonly amount: number | null;
  /** For a transfer still on the live tape: the gate's own score and decision for it. Never inferred. */
  readonly decided?: { readonly score: number; readonly band: RiskBand; readonly decision: Decision };
  /** For an intervention: the state it recorded. */
  readonly state?: InterventionState;
}
