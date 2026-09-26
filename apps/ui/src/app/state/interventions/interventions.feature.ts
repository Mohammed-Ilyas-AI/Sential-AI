import type { Intervention } from '@sentinel/domain';
import { createFeature, createReducer, createSelector, on } from '@ngrx/store';
import { InterventionsActions } from './interventions.actions';

/** Append-only on the server; mirrored here, in order, as the audit trail the analyst reads. */
export interface InterventionsState {
  readonly byTransactionId: Readonly<Record<string, readonly Intervention[]>>;
}

const initialInterventionsState: InterventionsState = { byTransactionId: {} };

function append(
  byTransactionId: Readonly<Record<string, readonly Intervention[]>>,
  intervention: Intervention,
): Readonly<Record<string, readonly Intervention[]>> {
  const history = byTransactionId[intervention.transactionId] ?? [];
  if (history.some((existing) => existing.id === intervention.id)) return byTransactionId;
  return { ...byTransactionId, [intervention.transactionId]: [...history, intervention] };
}

export const interventionsFeature = createFeature({
  name: 'interventions',
  reducer: createReducer(
    initialInterventionsState,
    on(InterventionsActions.snapshotLoaded, (_state, { interventions }) => ({
      byTransactionId: interventions.reduce(append, {} as Readonly<Record<string, readonly Intervention[]>>),
    })),
    on(InterventionsActions.interventionAppended, (state, { intervention }) => ({
      byTransactionId: append(state.byTransactionId, intervention),
    })),
  ),
  extraSelectors: ({ selectByTransactionId }) => {
    const selectLatestByTransaction = createSelector(selectByTransactionId, (byTransactionId) =>
      Object.values(byTransactionId).flatMap((history) => history.slice(-1)),
    );
    return {
      selectLatestByTransaction,
      selectActiveHolds: createSelector(selectLatestByTransaction, (latest) => latest.filter((intervention) => intervention.state === 'HELD')),
      selectAllInterventions: createSelector(selectByTransactionId, (byTransactionId) => Object.values(byTransactionId).flat()),
    };
  },
});
