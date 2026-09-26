import type { StreamCursor } from '@sentinel/domain';

/** Remembers the last server-issued global cursor so a reconnect resumes the tape where it stopped. */
export abstract class StreamCursorStore {
  abstract current(): StreamCursor | null;
  abstract remember(cursor: StreamCursor): void;
}
