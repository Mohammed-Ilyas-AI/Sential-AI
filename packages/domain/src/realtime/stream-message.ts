import type { Alert } from '../alert/alert.js';
import type { DecisionRecord } from '../decision/decision-record.js';
import type { Intervention } from '../intervention/intervention.js';
import type { IsoTimestamp } from '../time/iso-timestamp.js';

/** Opaque, server-issued global cursor (the change-stream resume token). */
export type StreamCursor = string;

export interface StreamEnvelope<TKind extends string, TPayload> {
  readonly kind: TKind;
  readonly cursor: StreamCursor;
  readonly emittedAt: IsoTimestamp;
  readonly payload: TPayload;
}

/** Server truth sent on connect and on request; it resets any optimistic client-side state. */
export interface StreamSnapshot {
  readonly decisions: readonly DecisionRecord[];
  readonly alerts: readonly Alert[];
  readonly interventions: readonly Intervention[];
}

export type DecisionStreamMessage = StreamEnvelope<'DECISION', DecisionRecord>;
export type AlertStreamMessage = StreamEnvelope<'ALERT', Alert>;
export type InterventionStreamMessage = StreamEnvelope<'INTERVENTION', Intervention>;
export type SnapshotStreamMessage = StreamEnvelope<'SNAPSHOT', StreamSnapshot>;
export type HeartbeatStreamMessage = StreamEnvelope<'HEARTBEAT', null>;

/** Everything sentinel-stream sends to the browser. */
export type StreamMessage =
  | DecisionStreamMessage
  | AlertStreamMessage
  | InterventionStreamMessage
  | SnapshotStreamMessage
  | HeartbeatStreamMessage;
