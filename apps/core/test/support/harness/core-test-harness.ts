import type { AddressInfo } from 'node:net';
import { DEFAULT_RAPID_DRAIN_POLICY } from '@sentinel/domain';
import { composeCoreHttp } from '../../../src/composition/core-http.composition.js';
import type { ControlPath } from '../../../src/composition/control-path.composition.js';
import type { SentinelPersistence } from '../../../src/composition/mongo-persistence.composition.js';
import type { PubSubPushVerification } from '../../../src/config/runtime-config.js';
import { createLogger } from '../../../src/infrastructure/telemetry/logger.js';
import type { IdGenerator } from '../../../src/platform/ids/id-generator.js';
import { TestClock } from './test-clock.js';

export interface CoreHarness {
  readonly baseUrl: string;
  readonly clock: TestClock;
  readonly controlPath: ControlPath;
  close(): Promise<void>;
}

/** Deterministic ids: the same scenario yields the same decisionIds on every run. */
export function sequentialIds(prefix = 'id'): IdGenerator {
  let next = 0;
  return { next: () => `${prefix}-${String((next += 1)).padStart(6, '0')}` };
}

/** The real HTTP app, the real services and the given persistence, listening on an ephemeral local port. */
export async function startCoreHarness(
  persistence: SentinelPersistence,
  options: {
    readonly clockStart?: string;
    readonly pubsubPush?: PubSubPushVerification;
    readonly designatedBillingPayeeIds?: ReadonlySet<string>;
  } = {},
): Promise<CoreHarness> {
  const clock = new TestClock(options.clockStart ?? '2026-09-24T11:30:00.000Z');
  const { app, controlPath } = composeCoreHttp({
    config: {
      corsAllowedOrigin: 'http://localhost:4200',
      rapidDrainPolicy: DEFAULT_RAPID_DRAIN_POLICY,
      designatedBillingPayeeIds: options.designatedBillingPayeeIds ?? new Set(),
      demoTimeCompression: false,
      pubsubPush: options.pubsubPush ?? { mode: 'disabled-for-local-development' },
      vertex: { projectId: '', location: 'asia-southeast1' },
    },
    persistence,
    clock,
    ids: sequentialIds(),
    logger: createLogger('silent'),
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    clock,
    controlPath,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}
