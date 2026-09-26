import type { StreamCursor } from '@sentinel/domain';

/**
 * Server-issued global cursor. A per-account sequence orders one account but cannot resume a multi-account
 * tape, so the cursor is the change-stream resume token.
 */
export interface StreamCursorCodec {
  encode(resumeToken: unknown): StreamCursor;
  decode(cursor: StreamCursor): unknown;
}
