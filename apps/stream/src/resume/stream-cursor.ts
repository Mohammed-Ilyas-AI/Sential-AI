import type { StreamCursor } from '@sentinel/domain';

/**
 * Server-issued global cursor. A per-account sequence orders one account but cannot resume a multi-account
 * tape, so the cursor is the change-stream resume token. A reconnecting client resumes by requesting a snapshot.
 */
export class StreamCursorTracker {
  private latest: StreamCursor = 'start';

  advance(resumeToken: unknown): StreamCursor {
    const data = typeof resumeToken === 'object' && resumeToken !== null ? (resumeToken as { _data?: unknown })._data : undefined;
    this.latest = typeof data === 'string' ? data : JSON.stringify(resumeToken);
    return this.latest;
  }

  current(): StreamCursor {
    return this.latest;
  }
}
