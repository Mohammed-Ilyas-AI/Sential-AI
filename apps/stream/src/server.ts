import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { TENANT_LENS_QUERY_PARAMETER, parseTenantLens, type TenantLens } from '@sentinel/domain';
import { WebSocketServer, type WebSocket } from 'ws';
import { parseClientMessage } from './client-messages/client-message-handler.js';
import type { ClientConnection, ConnectionRegistry } from './connections/client-connection.js';
import { AccountInstitutionDirectory, TenantLensConnection } from './connections/tenant-lens-connection.js';
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
  readonly allowedOrigins: readonly string[];
  readonly heartbeat: HeartbeatPolicy;
  readonly logger: Logger;
}

export const STREAM_PATH = '/stream';

/** HTTP for Cloud Run health checks plus the WebSocket upgrade. Transport only: no rules, no policy, no AI. */
export function createStreamServer(dependencies: StreamServerDependencies): Server {
  const { registry, snapshots, cursors, allowedOrigins, heartbeat, logger } = dependencies;
  const allowed = new Set(allowedOrigins);
  const sockets = new WebSocketServer({ noServer: true });
  const directory = new AccountInstitutionDirectory();

  const server = createServer((request, response) => {
    if (request.url === '/healthz') {
      response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ status: 'ok', connections: registry.size() }));
      return;
    }
    response.writeHead(404).end();
  });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '/', 'http://stream.local');
    const lens = parseTenantLens(url.searchParams.get(TENANT_LENS_QUERY_PARAMETER) ?? undefined);
    if (url.pathname !== STREAM_PATH || !allowed.has(request.headers.origin ?? '') || lens === 'INVALID') {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }
    sockets.handleUpgrade(request, socket, head, (webSocket) => sockets.emit('connection', webSocket, lens));
  });

  const sendSnapshot = async (connection: ClientConnection): Promise<void> => {
    try {
      connection.send(snapshotMessage(await snapshots.currentSnapshot(), cursors.current(), new Date().toISOString()));
    } catch (error) {
      logger.error({ err: error }, 'snapshot failed');
    }
  };

  sockets.on('connection', (webSocket: WebSocket, lens: TenantLens) => {
    const socketConnection = new WebSocketClientConnection(randomUUID(), webSocket);
    // A lensed client receives only its own institution's records (T§14); the operator view receives everything.
    const connection: ClientConnection = lens ? new TenantLensConnection(socketConnection, lens, directory) : socketConnection;
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
