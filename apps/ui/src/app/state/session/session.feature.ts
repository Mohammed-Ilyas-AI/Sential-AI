import { createFeature, createReducer, on } from '@ngrx/store';
import { SessionActions } from './session.actions';

export type StreamConnectionStatus = 'CONNECTING' | 'LIVE' | 'RECONNECTING';

/** The single labelled demo login and the live stream's health. */
export interface SessionState {
  readonly analystIdentity: string | null;
  readonly streamStatus: StreamConnectionStatus;
}

/** The prototype has one labelled demo login; its identity is recorded on every analyst action. */
const initialSessionState: SessionState = { analystIdentity: 'demo-analyst', streamStatus: 'CONNECTING' };

export const sessionFeature = createFeature({
  name: 'session',
  reducer: createReducer(
    initialSessionState,
    on(SessionActions.streamStatusChanged, (state, { status }) => ({ ...state, streamStatus: status })),
  ),
});
