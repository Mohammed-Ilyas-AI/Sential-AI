import { createFeature, createReducer } from '@ngrx/store';

/** The single labelled demo login; its identity is recorded on every analyst action. */
export interface SessionState {
  readonly analystIdentity: string | null;
}

const initialSessionState: SessionState = { analystIdentity: null };

export const sessionFeature = createFeature({
  name: 'session',
  reducer: createReducer(initialSessionState),
});
