import type { StreamCursor } from '@sentinel/domain';

/** On (re)connect the client requests a snapshot; server truth resets optimistic worker state. */
export abstract class SnapshotSync {
  abstract requestSnapshot(resumeFrom?: StreamCursor): void;
}
