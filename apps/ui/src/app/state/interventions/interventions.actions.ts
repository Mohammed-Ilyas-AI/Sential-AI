import type { Intervention } from '@sentinel/domain';
import { createActionGroup, props } from '@ngrx/store';

export const InterventionsActions = createActionGroup({
  source: 'Interventions',
  events: {
    'Snapshot Loaded': props<{ readonly interventions: readonly Intervention[] }>(),
    'Intervention Appended': props<{ readonly intervention: Intervention }>(),
  },
});
