import type { StreamClientMessage } from '@sentinel/domain';

export function parseClientMessage(raw: string): StreamClientMessage | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value === 'object' && value !== null && (value as { kind?: unknown }).kind === 'SNAPSHOT_REQUEST') {
      return { kind: 'SNAPSHOT_REQUEST' };
    }
  } catch {
    return null;
  }
  return null;
}
