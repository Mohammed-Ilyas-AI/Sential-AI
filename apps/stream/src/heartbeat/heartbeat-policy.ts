import type { WebSocket } from 'ws';

/** Keeps idle sockets alive under the 60-minute Cloud Run request timeout and drops clients that stop answering. */
export interface HeartbeatPolicy {
  readonly intervalMs: number;
}

const alive = new WeakMap<WebSocket, boolean>();

export function trackLiveness(socket: WebSocket): void {
  alive.set(socket, true);
  socket.on('pong', () => alive.set(socket, true));
}

/** Terminates sockets that missed the previous ping, then pings the rest. */
export function sweepLiveness(sockets: Iterable<WebSocket>): void {
  for (const socket of sockets) {
    if (alive.get(socket) === false) {
      socket.terminate();
      continue;
    }
    alive.set(socket, false);
    socket.ping();
  }
}
