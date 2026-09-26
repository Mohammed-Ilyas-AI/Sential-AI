import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { parseClientMessage } from './client-messages/client-message-handler.js';
import type { ConnectionRegistry } from './connections/client-connection.js';
import { WebSocketClientConnection } from './connections/websocket-client-connection.js';
import { sweepLiveness, trackLiveness, type HeartbeatPolicy } from './heartbeat/heartbeat-policy.js';
import { heartbeatMessage, snapshotMessage } from './messages/stream-message.normalizer.js';
import type { StreamCursorTracker } from './resume/stream-cursor.js';
import type { StreamSnapshotSource } from './snapshot/stream-snapshot-source.js';
import type { Logger } from './telemetry/logger.js';

export interface StreamServerDependencies {
  readonly registry: ConnectionRegistry;
  readonly snapshots: StreamSnapshotSource;
  readonly cursors: StreamCursorTracker;
  readonly allowedOrigin: string;
  readonly heartbeat: HeartbeatPolicy;
  readonly logger: Logger;
}

export const STREAM_PATH = '/stream';

/** HTTP for Cloud Run health checks plus the WebSocket upgrade. Transport only: no rules, no policy, no AI. */
export function createStreamServer(dependencies: StreamServerDependencies): Server {
  const { registry, snapshots, cursors, allowedOrigin, heartbeat, logger } = dependencies;
  const sockets = new WebSocketServer({ noServer: true });

  const server = createServer((request, response) => {
    if (request.url === '/healthz') {
      response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ status: 'ok', connections: registry.size() }));
      return;
    }
    response.writeHead(404).end();
  });

  server.on('upgrade', (request, socket, head) => {
    if (request.url !== STREAM_PATH || request.headers.origin !== allowedOrigin) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }
    sockets.handleUpgrade(request, socket, head, (webSocket) => sockets.emit('connection', webSocket));
  });

  const sendSnapshot = async (connection: WebSocketClientConnection): Promise<void> => {
    try {
      connection.send(snapshotMessage(await snapshots.currentSnapshot(), cursors.current(), new Date().toISOString()));
    } catch (error) {
      logger.error({ err: error }, 'snapshot failed');
    }
  };

  sockets.on('connection', (webSocket: WebSocket) => {
    const connection = new WebSocketClientConnection(randomUUID(), webSocket);
    trackLiveness(webSocket);
    registry.add(connection);
    webSocket.on('message', (data) => {
      if (parseClientMessage(String(data))?.kind === 'SNAPSHOT_REQUEST') void sendSnapshot(connection);
    });
    webSocket.on('close', () => registry.remove(connection.id));
    void sendSnapshot(connection);
  });

  const heartbeatTimer = setInterval(() => {
    sweepLiveness(sockets.clients);
    registry.broadcast(heartbeatMessage(cursors.current(), new Date().toISOString()));
  }, heartbeat.intervalMs);
  heartbeatTimer.unref();
  server.on('close', () => {
    clearInterval(heartbeatTimer);
    for (const client of sockets.clients) client.terminate();
  });

  return server;
}
