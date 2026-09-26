import type { AccountSnapshot } from '@sentinel/domain';

/** Server truth replayed on (re)connect, so the gateway holds no per-connection state it cannot rebuild. */
export interface AccountSnapshotSource {
  currentSnapshot(): Promise<readonly AccountSnapshot[]>;
}
