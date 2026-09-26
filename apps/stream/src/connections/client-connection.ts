import type { StreamMessage } from '@sentinel/domain';

export interface ClientConnection {
  readonly id: string;
  send(message: StreamMessage): void;
  close(): void;
}

/** Fan-out target for every normalised message. Holds nothing that a reconnect cannot rebuild. */
export interface ConnectionRegistry {
  add(connection: ClientConnection): void;
  remove(connectionId: string): void;
  broadcast(message: StreamMessage): void;
}
