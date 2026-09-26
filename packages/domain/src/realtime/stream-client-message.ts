import type { StreamCursor } from './stream-message.js';

export interface SnapshotRequestMessage {
  readonly kind: 'SNAPSHOT_REQUEST';
  readonly resumeFrom?: StreamCursor;
}

/** Everything the browser sends to sentinel-stream. */
export type StreamClientMessage = SnapshotRequestMessage;
