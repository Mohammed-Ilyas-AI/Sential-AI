import type { Alert, RiskBand } from '@sentinel/domain';

/** One case as the list shows it: an open alert is an open case on its account. */
export interface CaseListItem {
  readonly caseId: string;
  readonly accountId: string;
  readonly reference: string;
  readonly band: RiskBand;
  readonly score: number;
  readonly onHold: boolean;
  readonly openedAt: string;
  readonly alert: Alert;
}

/** The analyst's attestation. Kept for this browser session: the case store is designed, not yet built. */
export interface CaseSignOff {
  readonly caseId: string;
  readonly analystIdentity: string;
  readonly disposition: 'ESCALATE' | 'MONITOR' | 'CLOSE_LEGITIMATE';
  readonly note: string;
  readonly signedAt: string;
}
