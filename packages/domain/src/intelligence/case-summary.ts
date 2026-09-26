export type CaseSummaryConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

export interface CaseSummaryEvidence {
  readonly claim: string;
  /** Must name a field in the bundle that was sent; a claim citing nothing is dropped before the UI. */
  readonly sourceField: string;
  readonly value: string;
}

export interface CaseSummary {
  /** At most 300 characters. */
  readonly hypothesis: string;
  readonly confidence: CaseSummaryConfidence;
  /** At most 5 items. */
  readonly evidence: readonly CaseSummaryEvidence[];
  readonly recommendedActions: readonly string[];
  readonly escalate: boolean;
}
