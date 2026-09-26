import type { StreamMessage } from '@sentinel/domain';
import type { ClientConnection, ConnectionRegistry } from './client-connection.js';

export class InProcessConnectionRegistry implements ConnectionRegistry {
  private readonly connections = new Map<string, ClientConnection>();

  add(connection: ClientConnection): void {
    this.connections.set(connection.id, connection);
  }

  remove(connectionId: string): void {
    this.connections.delete(connectionId);
  }

  broadcast(message: StreamMessage): void {
    for (const connection of this.connections.values()) connection.send(message);
  }
}
