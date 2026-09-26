import type { StreamClientMessage } from '@sentinel/domain';

/** Handles what a browser may send: a snapshot request, optionally resuming from a cursor. */
export interface ClientMessageHandler {
  handle(connectionId: string, message: StreamClientMessage): Promise<void>;
}
