import type { StreamMessage } from '@sentinel/domain';
import { describe, expect, it } from 'vitest';
import type { ClientConnection } from './client-connection.js';
import { InProcessConnectionRegistry } from './in-process-connection-registry.js';

const heartbeat: StreamMessage = { kind: 'HEARTBEAT', cursor: 'cursor-1', emittedAt: '2026-09-24T00:00:00.000Z', payload: null };

function recordingConnection(id: string): ClientConnection & { readonly received: StreamMessage[] } {
  const received: StreamMessage[] = [];
  return { id, received, send: (message) => received.push(message), close: () => undefined };
}

describe('InProcessConnectionRegistry', () => {
  it('broadcasts to every connected client and stops after removal', () => {
    const registry = new InProcessConnectionRegistry();
    const first = recordingConnection('client-1');
    const second = recordingConnection('client-2');
    registry.add(first);
    registry.add(second);
    registry.broadcast(heartbeat);
    registry.remove('client-2');
    registry.broadcast(heartbeat);
    expect(first.received).toHaveLength(2);
    expect(second.received).toHaveLength(1);
  });
});
