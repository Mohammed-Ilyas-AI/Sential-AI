import type { Alert } from '../alert/alert.js';
import type { DecisionRecord } from '../decision/decision-record.js';
import type { Intervention } from '../intervention/intervention.js';
import type { IsoTimestamp } from '../time/iso-timestamp.js';
import type { AccountSnapshot } from './account-snapshot.js';

/** Opaque, server-issued global cursor that resumes a multi-account tape after reconnect. */
export type StreamCursor = string;

export interface StreamEnvelope<TKind extends string, TPayload> {
  readonly kind: TKind;
  readonly cursor: StreamCursor;
  readonly emittedAt: IsoTimestamp;
  readonly payload: TPayload;
}

export type DecisionStreamMessage = StreamEnvelope<'DECISION', DecisionRecord>;
export type AlertStreamMessage = StreamEnvelope<'ALERT', Alert>;
export type InterventionStreamMessage = StreamEnvelope<'INTERVENTION', Intervention>;
export type SnapshotStreamMessage = StreamEnvelope<'SNAPSHOT', readonly AccountSnapshot[]>;
export type HeartbeatStreamMessage = StreamEnvelope<'HEARTBEAT', null>;

/** Everything sentinel-stream sends to the browser. */
export type StreamMessage =
  | DecisionStreamMessage
  | AlertStreamMessage
  | InterventionStreamMessage
  | SnapshotStreamMessage
  | HeartbeatStreamMessage;
