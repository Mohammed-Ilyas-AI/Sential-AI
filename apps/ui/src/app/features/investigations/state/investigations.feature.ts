import type { CaseSummary, EvidenceBundle } from '@sentinel/domain';
import { createFeature, createReducer } from '@ngrx/store';

/** Feature-local: only the investigation workspace reads it. */
export interface InvestigationsState {
  readonly activeAlertId: string | null;
  readonly evidence: EvidenceBundle | null;
  readonly summary: CaseSummary | null;
  readonly summaryStatus: 'IDLE' | 'LOADING' | 'READY' | 'UNAVAILABLE';
}

const initialInvestigationsState: InvestigationsState = {
  activeAlertId: null,
  evidence: null,
  summary: null,
  summaryStatus: 'IDLE',
};

export const investigationsFeature = createFeature({
  name: 'investigations',
  reducer: createReducer(initialInvestigationsState),
});
