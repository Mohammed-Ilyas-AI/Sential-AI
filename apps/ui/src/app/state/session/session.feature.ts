import { createFeature, createReducer, on } from '@ngrx/store';
import { SessionActions } from './session.actions';

export type StreamConnectionStatus = 'CONNECTING' | 'LIVE' | 'RECONNECTING';

/** The single labelled demo login and the live stream's health. */
export interface SessionState {
  readonly analystIdentity: string | null;
  readonly streamStatus: StreamConnectionStatus;
}

const initialSessionState: SessionState = { analystIdentity: null, streamStatus: 'CONNECTING' };

export const sessionFeature = createFeature({
  name: 'session',
  reducer: createReducer(
    initialSessionState,
    on(SessionActions.streamStatusChanged, (state, { status }) => ({ ...state, streamStatus: status })),
  ),
});
