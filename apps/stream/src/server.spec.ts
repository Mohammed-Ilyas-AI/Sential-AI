import type { AddressInfo } from 'node:net';
import type { StreamMessage, StreamSnapshot } from '@sentinel/domain';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { InProcessConnectionRegistry } from './connections/in-process-connection-registry.js';
import { StreamCursorTracker } from './resume/stream-cursor.js';
import { STREAM_PATH, createStreamServer } from './server.js';
import { createLogger } from './telemetry/logger.js';

const ORIGIN = 'http://localhost:4200';
/** The same UI under a second address, as a deployment may serve it. */
const SECOND_ORIGIN = 'https://sentinel.example.run';
const snapshot: StreamSnapshot = { decisions: [], alerts: [], interventions: [] };

function openClient(baseUrl: string, origin = ORIGIN): Promise<{ socket: WebSocket; messages: StreamMessage[]; next: () => Promise<StreamMessage> }> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${baseUrl}${STREAM_PATH}`, { origin });
    const messages: StreamMessage[] = [];
    const waiters: ((message: StreamMessage) => void)[] = [];
    socket.on('message', (data) => {
      const message = JSON.parse(String(data)) as StreamMessage;
      const waiter = waiters.shift();
      if (waiter) waiter(message);
      else messages.push(message);
    });
    const next = () => new Promise<StreamMessage>((resolveNext) => {
      const queued = messages.shift();
      if (queued) resolveNext(queued);
      else waiters.push(resolveNext);
    });
    socket.once('open', () => resolve({ socket, messages, next }));
    socket.once('error', reject);
  });
}

describe('sentinel-stream server', () => {
  let registry: InProcessConnectionRegistry;
  let baseUrl: string;
  let close: () => Promise<void>;

  beforeEach(async () => {
    registry = new InProcessConnectionRegistry();
    const server = createStreamServer({
      registry,
      snapshots: { currentSnapshot: async () => snapshot },
      cursors: new StreamCursorTracker(),
      allowedOrigins: [ORIGIN, SECOND_ORIGIN],
      heartbeat: { intervalMs: 60_000 },
      logger: createLogger('silent'),
    });
    server.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `ws://127.0.0.1:${(server.address() as AddressInfo).port}`;
    close = () => new Promise((resolve) => server.close(() => resolve()));
  });

  afterEach(() => close());

  it('sends a snapshot on connect and on request', async () => {
    const client = await openClient(baseUrl);
    expect((await client.next()).kind).toBe('SNAPSHOT');
    client.socket.send(JSON.stringify({ kind: 'SNAPSHOT_REQUEST' }));
    expect(await client.next()).toMatchObject({ kind: 'SNAPSHOT', payload: snapshot });
    client.socket.close();
  });

  it('broadcasts committed changes to every connected client', async () => {
    const first = await openClient(baseUrl);
    const second = await openClient(baseUrl);
    await first.next();
    await second.next();
    const decision = { kind: 'DECISION', cursor: 'c-1', emittedAt: 't', payload: { decisionId: 'dec-1' } } as unknown as StreamMessage;
    registry.broadcast(decision);
    expect(await first.next()).toEqual(decision);
    expect(await second.next()).toEqual(decision);
    first.socket.close();
    second.socket.close();
  });

  it('accepts every configured UI origin, each exactly', async () => {
    const client = await openClient(baseUrl, SECOND_ORIGIN);
    expect((await client.next()).kind).toBe('SNAPSHOT');
    client.socket.close();
    await expect(openClient(baseUrl, `${SECOND_ORIGIN}.evil.test`)).rejects.toThrow();
  });

  it('refuses a connection from any other origin', async () => {
    await expect(openClient(baseUrl, 'https://evil.example')).rejects.toThrow();
  });

  it('forgets a client when it disconnects', async () => {
    const client = await openClient(baseUrl);
    await client.next();
    expect(registry.size()).toBe(1);
    client.socket.close();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(registry.size()).toBe(0);
  });
});
