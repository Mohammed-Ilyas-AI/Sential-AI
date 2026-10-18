import type { ScenarioLaunchCapability, ScenarioRun } from '@sentinel/domain';
import { afterEach, describe, expect, it } from 'vitest';
import type { ScenarioLaunchRequest, ScenarioRunner, ScenarioRunUpdate } from '../../src/modules/scenarios/application/ports/scenario-runner.port.js';
import { startCoreHarness, type CoreHarness } from '../support/harness/core-test-harness.js';
import { callJson } from '../support/harness/http-bank-connector.js';
import { createInMemoryPersistence, type InMemoryPersistence } from '../support/in-memory-repositories/in-memory-persistence.js';

const EPOCH = '2026-09-24T11:30:00.000Z';

/** A launcher that records what it was asked and finishes when the test says so. */
class ScriptedRunner implements ScenarioRunner {
  readonly capability: ScenarioLaunchCapability = { available: true, launcher: 'LOCAL_PROCESS' };
  readonly launched: ScenarioLaunchRequest[] = [];
  private readonly progress = new Map<string, (update: ScenarioRunUpdate) => Promise<void>>();
  private readonly state = new Map<string, ScenarioRunUpdate>();

  async launch(request: ScenarioLaunchRequest, onUpdate: (update: ScenarioRunUpdate) => Promise<void>) {
    this.launched.push(request);
    this.progress.set(request.runId, onUpdate);
    this.state.set(request.runId, { status: 'RUNNING', at: EPOCH });
    return {};
  }

  async finish(runId: string, update: ScenarioRunUpdate): Promise<void> {
    this.state.set(runId, update);
    await this.progress.get(runId)?.(update);
  }

  async status(runId: string): Promise<ScenarioRunUpdate | null> {
    return this.state.get(runId) ?? null;
  }
}

type Written = { outcome: 'CREATED' | 'DUPLICATE'; record: ScenarioRun };

describe('/v1/demo/scenario-runs — the in-app synthetic scenario launcher', () => {
  let harness: CoreHarness;
  let persistence: InMemoryPersistence;
  afterEach(() => harness.close());

  const launch = (idempotencyKey: string, extra: Record<string, unknown> = {}) =>
    callJson<Written>(harness.baseUrl, 'POST', '/v1/demo/scenario-runs', { analystIdentity: 'analyst.tan', idempotencyKey, ...extra });

  it('starts one run through the server boundary, answers a retry with the same run and refuses a second while it runs', async () => {
    const runner = new ScriptedRunner();
    persistence = createInMemoryPersistence();
    harness = await startCoreHarness(persistence, { clockStart: EPOCH, scenarioRunner: runner });

    const first = await launch('launch-1', { noise: { seed: 42, ratePerMinute: 6 } });
    expect(first.status).toBe(202);
    expect(first.body.record).toMatchObject({ status: 'RUNNING', scenarioId: 'DEMO_TAKEOVER_01', requestedBy: 'analyst.tan', noise: { seed: 42, ratePerMinute: 6 } });
    expect(first.body.record.runId).toMatch(/^[A-Z0-9]{1,12}$/);
    expect(runner.launched).toEqual([{ runId: first.body.record.runId, noise: { seed: 42, ratePerMinute: 6 } }]);

    const retry = await launch('launch-1', { noise: { seed: 42, ratePerMinute: 6 } });
    expect(retry.status).toBe(200);
    expect(retry.body).toMatchObject({ outcome: 'DUPLICATE', record: { runId: first.body.record.runId } });
    expect((await launch('launch-2')).status).toBe(409);
    expect(runner.launched).toHaveLength(1);

    await runner.finish(first.body.record.runId, { status: 'COMPLETED', at: '2026-09-24T11:31:00.000Z' });
    const done = await callJson<ScenarioRun>(harness.baseUrl, 'GET', `/v1/demo/scenario-runs/${first.body.record.runId}`);
    expect(done.body).toMatchObject({ status: 'COMPLETED', finishedAt: '2026-09-24T11:31:00.000Z' });
    expect(persistence.auditLog.all().map((event) => event.action)).toEqual(['SCENARIO_LAUNCH_REQUESTED']);
  });

  it('reports failure truthfully and never carries a command, credential or environment in the response', async () => {
    const runner = new ScriptedRunner();
    harness = await startCoreHarness(createInMemoryPersistence(), { clockStart: EPOCH, scenarioRunner: runner });
    const run = (await launch('launch-1')).body.record;
    await runner.finish(run.runId, { status: 'FAILED', at: EPOCH, failure: 'The simulator exited with code 1' });
    const failed = await callJson<ScenarioRun>(harness.baseUrl, 'GET', `/v1/demo/scenario-runs/${run.runId}`);
    expect(failed.body).toMatchObject({ status: 'FAILED', failure: 'The simulator exited with code 1' });
    expect(JSON.stringify(failed.body)).not.toMatch(/npm|SIMULATOR_|MONGODB|token|password/i);
    expect((await launch('launch-2')).status).toBe(202);
  });

  it('bounds the noise settings and requires an analyst', async () => {
    harness = await startCoreHarness(createInMemoryPersistence(), { clockStart: EPOCH, scenarioRunner: new ScriptedRunner() });
    expect((await launch('n-1', { noise: { seed: 1, ratePerMinute: 61 } })).status).toBe(422);
    expect((await launch('n-2', { noise: { seed: 1, ratePerMinute: 0 } })).status).toBe(400);
    expect((await callJson(harness.baseUrl, 'POST', '/v1/demo/scenario-runs', { idempotencyKey: 'n-3' })).status).toBe(400);
    expect((await callJson(harness.baseUrl, 'GET', '/v1/demo/scenario-runs/NOPE')).status).toBe(404);
  });

  it('says when no launcher is configured instead of pretending to start a run', async () => {
    harness = await startCoreHarness(createInMemoryPersistence(), { clockStart: EPOCH });
    const capability = await callJson<ScenarioLaunchCapability>(harness.baseUrl, 'GET', '/v1/demo/scenario-runs/capability');
    expect(capability.body).toMatchObject({ available: false, launcher: 'DISABLED' });
    expect(capability.body.reason).toContain('npm run simulate');
    expect((await launch('launch-1')).status).toBe(409);
    expect((await callJson<{ runs: ScenarioRun[] }>(harness.baseUrl, 'GET', '/v1/demo/scenario-runs')).body.runs).toEqual([]);
  });
});
