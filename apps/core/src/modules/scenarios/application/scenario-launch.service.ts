import {
  SCENARIO_NOISE_MAX_RATE_PER_MINUTE,
  type ScenarioLaunchCapability,
  type ScenarioNoiseSettings,
  type ScenarioRun,
} from '@sentinel/domain';
import { ApplicationError } from '../../../platform/errors/application-error.js';
import type { Clock } from '../../../platform/time/clock.js';
import type { ActingContext, AuditTrail } from '../../audit/application/audit-trail.js';
import type { ScenarioRunRepository } from './ports/scenario-run-repository.port.js';
import type { ScenarioRunner, ScenarioRunUpdate } from './ports/scenario-runner.port.js';

/** A run that has said nothing for this long is not blocking another launch. */
const ACTIVE_RUN_TTL_MS = 15 * 60_000;

export interface LaunchInput {
  readonly idempotencyKey: string;
  readonly noise: ScenarioNoiseSettings | null;
}

/**
 * The in-app launcher for the synthetic DEMO_TAKEOVER_01 (M§7 attack simulation mode). One run at a time; a retry
 * with the same key returns the same run. Each run has its own run ID, so it is new activity on fresh synthetic
 * accounts rather than a replay; the control path deduplicates every event inside it.
 */
export class ScenarioLaunchService {
  constructor(
    private readonly runs: ScenarioRunRepository,
    private readonly runner: ScenarioRunner,
    private readonly audit: AuditTrail,
    private readonly clock: Clock,
  ) {}

  capability(): ScenarioLaunchCapability {
    return this.runner.capability;
  }

  async launch(context: ActingContext, input: LaunchInput): Promise<{ readonly outcome: 'CREATED' | 'DUPLICATE'; readonly record: ScenarioRun }> {
    if (context.actor !== 'ANALYST' || !context.actorIdentity?.trim()) throw new ApplicationError('UNPROCESSABLE', 'An analyst identity is required');
    const capability = this.runner.capability;
    if (!capability.available) throw new ApplicationError('CONFLICT', capability.reason ?? 'Scenario launch is not configured here');
    if (input.noise && (!Number.isSafeInteger(input.noise.seed) || !Number.isInteger(input.noise.ratePerMinute) || input.noise.ratePerMinute < 1 || input.noise.ratePerMinute > SCENARIO_NOISE_MAX_RATE_PER_MINUTE)) {
      throw new ApplicationError('UNPROCESSABLE', `Noise needs an integer seed and 1 to ${SCENARIO_NOISE_MAX_RATE_PER_MINUTE} events per minute`);
    }

    const now = this.clock.now();
    for (const active of await this.runs.findActive()) {
      if (now.getTime() - Date.parse(active.updatedAt) > ACTIVE_RUN_TTL_MS) {
        await this.runs.update(active.runId, { status: 'FAILED', updatedAt: now.toISOString(), finishedAt: now.toISOString(), failure: 'No progress reported; treated as abandoned' });
        continue;
      }
      if (active.idempotencyKey === input.idempotencyKey) return { outcome: 'DUPLICATE', record: active };
      throw new ApplicationError('CONFLICT', `Run ${active.runId} is still ${active.status.toLowerCase()}; wait for it to finish`);
    }

    const run: ScenarioRun = {
      runId: Math.trunc(now.getTime()).toString(36).toUpperCase(),
      scenarioId: 'DEMO_TAKEOVER_01',
      status: 'LAUNCHING',
      launcher: capability.launcher === 'CLOUD_RUN_JOB' ? 'CLOUD_RUN_JOB' : 'LOCAL_PROCESS',
      noise: input.noise,
      requestedBy: context.actorIdentity,
      requestedAt: now.toISOString(),
      idempotencyKey: input.idempotencyKey,
      updatedAt: now.toISOString(),
    };
    const written = await this.runs.insert(run);
    if (written.outcome === 'DUPLICATE') return written;

    await this.audit.record(context, {
      category: 'SCENARIO',
      action: 'SCENARIO_LAUNCH_REQUESTED',
      outcome: 'SUCCEEDED',
      subject: { runId: run.runId },
      detail: input.noise ? `DEMO_TAKEOVER_01 with seeded noise at ${input.noise.ratePerMinute}/min` : 'DEMO_TAKEOVER_01',
    });
    try {
      const { executionName } = await this.runner.launch({ runId: run.runId, noise: input.noise }, (update) => this.apply(run.runId, update).then(() => undefined));
      const stored = await this.runs.update(run.runId, {
        status: 'RUNNING',
        updatedAt: this.clock.now().toISOString(),
        ...(executionName ? { executionName } : {}),
      });
      return { outcome: 'CREATED', record: stored ?? run };
    } catch {
      const at = this.clock.now().toISOString();
      const failed = await this.runs.update(run.runId, { status: 'FAILED', updatedAt: at, finishedAt: at, failure: 'The launcher could not start the simulator' });
      return { outcome: 'CREATED', record: failed ?? run };
    }
  }

  /** The stored run, refreshed from the launcher while it is still in progress. */
  async get(runId: string): Promise<ScenarioRun> {
    const run = await this.runs.findById(runId);
    if (!run) throw new ApplicationError('NOT_FOUND', `No scenario run ${runId}`);
    if (run.status !== 'LAUNCHING' && run.status !== 'RUNNING') return run;
    const update = await this.runner.status(run.runId, run.executionName);
    if (update === null) {
      const at = this.clock.now().toISOString();
      return (await this.runs.update(run.runId, { status: 'FAILED', updatedAt: at, finishedAt: at, failure: 'The launcher lost track of this run (sentinel-core restarted)' })) ?? run;
    }
    return (await this.apply(run.runId, update)) ?? run;
  }

  list(limit: number): Promise<readonly ScenarioRun[]> {
    return this.runs.list(limit);
  }

  private apply(runId: string, update: ScenarioRunUpdate): Promise<ScenarioRun | null> {
    const finished = update.status === 'COMPLETED' || update.status === 'FAILED';
    return this.runs.update(runId, {
      status: update.status,
      updatedAt: update.at,
      ...(finished ? { finishedAt: update.at } : {}),
      ...(update.failure ? { failure: update.failure } : {}),
    });
  }
}
