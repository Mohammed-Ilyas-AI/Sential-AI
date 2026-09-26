import { createActionGroup, props } from '@ngrx/store';
import type { StreamConnectionStatus } from './session.feature';

export const SessionActions = createActionGroup({
  source: 'Session',
  events: {
    'Stream Status Changed': props<{ readonly status: StreamConnectionStatus }>(),
  },
});
