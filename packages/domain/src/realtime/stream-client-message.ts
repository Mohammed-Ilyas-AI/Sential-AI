/** Everything the browser sends to sentinel-stream: a request for a fresh snapshot after (re)connecting. */
export interface SnapshotRequestMessage {
  readonly kind: 'SNAPSHOT_REQUEST';
}

export type StreamClientMessage = SnapshotRequestMessage;
