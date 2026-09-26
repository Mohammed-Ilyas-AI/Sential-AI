import type { Intervention } from '@sentinel/domain';
import { createFeature, createReducer } from '@ngrx/store';

/** Append-only on the server; mirrored here as the audit trail the analyst reads. */
export interface InterventionsState {
  readonly byTransactionId: Readonly<Record<string, readonly Intervention[]>>;
}

const initialInterventionsState: InterventionsState = { byTransactionId: {} };

export const interventionsFeature = createFeature({
  name: 'interventions',
  reducer: createReducer(initialInterventionsState),
});
