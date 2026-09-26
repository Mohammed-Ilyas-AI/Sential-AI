import type { StreamMessage } from '@sentinel/domain';
import { WebSocket } from 'ws';
import type { ClientConnection } from './client-connection.js';

export class WebSocketClientConnection implements ClientConnection {
  constructor(
    readonly id: string,
    private readonly socket: WebSocket,
  ) {}

  send(message: StreamMessage): void {
    if (this.socket.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  close(): void {
    this.socket.close();
  }
}
