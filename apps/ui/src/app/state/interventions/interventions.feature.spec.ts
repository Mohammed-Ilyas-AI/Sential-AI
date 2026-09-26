import { describe, expect, it } from 'vitest';
import { demoHold } from '../../../testing/ui-fixtures';
import { InterventionsActions } from './interventions.actions';
import { interventionsFeature } from './interventions.feature';

const reduce = interventionsFeature.reducer;
const initial = reduce(undefined, { type: '@@init' });

describe('interventions feature', () => {
  const held = demoHold();
  const released = demoHold({ id: 'int_demo_2', previousState: 'HELD', state: 'RELEASED', actor: 'CUSTOMER' });

  it('appends in order and ignores a redelivered record', () => {
    const state = [held, held, released].reduce(
      (current, intervention) => reduce(current, InterventionsActions.interventionAppended({ intervention })),
      initial,
    );
    expect(state.byTransactionId[held.transactionId]?.map((intervention) => intervention.id)).toEqual(['int_demo_1', 'int_demo_2']);
  });

  it('counts a transaction as held only while its latest record is HELD', () => {
    const heldOnly = reduce(initial, InterventionsActions.snapshotLoaded({ interventions: [held] }));
    const latestHeld = interventionsFeature.selectLatestByTransaction.projector(heldOnly.byTransactionId);
    expect(interventionsFeature.selectActiveHolds.projector(latestHeld)).toHaveLength(1);

    const afterRelease = reduce(heldOnly, InterventionsActions.interventionAppended({ intervention: released }));
    const latestReleased = interventionsFeature.selectLatestByTransaction.projector(afterRelease.byTransactionId);
    expect(interventionsFeature.selectActiveHolds.projector(latestReleased)).toHaveLength(0);
  });
});
