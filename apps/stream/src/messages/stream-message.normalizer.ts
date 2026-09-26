import type { Alert, DecisionRecord, Intervention, StreamMessage, StreamSnapshot } from '@sentinel/domain';
import type { WatchedCollection } from '../change-stream/change-feed.js';

export interface RawChange {
  readonly collection: WatchedCollection;
  readonly document: Readonly<Record<string, unknown>>;
  readonly cursor: string;
}

function withoutStorageFields(document: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const { _id, ordinal, ...record } = document;
  return record;
}

/** Maps a committed change into the shared domain contract; the browser never sees a MongoDB shape. */
export function normaliseChange(change: RawChange, emittedAt: string): StreamMessage {
  const payload = withoutStorageFields(change.document);
  switch (change.collection) {
    case 'decisions':
      return { kind: 'DECISION', cursor: change.cursor, emittedAt, payload: payload as unknown as DecisionRecord };
    case 'alerts':
      return { kind: 'ALERT', cursor: change.cursor, emittedAt, payload: payload as unknown as Alert };
    case 'interventions':
      return { kind: 'INTERVENTION', cursor: change.cursor, emittedAt, payload: payload as unknown as Intervention };
  }
}

export function snapshotMessage(snapshot: StreamSnapshot, cursor: string, emittedAt: string): StreamMessage {
  return { kind: 'SNAPSHOT', cursor, emittedAt, payload: snapshot };
}

export function heartbeatMessage(cursor: string, emittedAt: string): StreamMessage {
  return { kind: 'HEARTBEAT', cursor, emittedAt, payload: null };
}
