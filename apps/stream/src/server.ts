import { createServer, type Server } from 'node:http';

/**
 * HTTP server for Cloud Run: /healthz now, the WebSocket upgrade (heartbeat, snapshot on connect, resume from
 * cursor, 250 ms client-side buffering) at build order step 4.
 */
export function createStreamServer(): Server {
  return createServer((request, response) => {
    if (request.url === '/healthz') {
      response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ status: 'ok' }));
      return;
    }
    response.writeHead(404).end();
  });
}
