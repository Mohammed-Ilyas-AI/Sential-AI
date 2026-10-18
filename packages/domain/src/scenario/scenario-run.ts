import type { IsoTimestamp } from '../time/iso-timestamp.js';

export type ScenarioRunStatus = 'LAUNCHING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

/** Seeded background traffic: low-level oddities that score ELEVATED but never trip the gate (T§9). */
export interface ScenarioNoiseSettings {
  readonly seed: number;
  /** Bounded by SCENARIO_NOISE_MAX_RATE_PER_MINUTE. */
  readonly ratePerMinute: number;
}

export const SCENARIO_NOISE_MAX_RATE_PER_MINUTE = 60;

/** One launch of a synthetic demo scenario. Synthetic only; never a real bank or customer. */
export interface ScenarioRun {
  readonly runId: string;
  readonly scenarioId: 'DEMO_TAKEOVER_01';
  readonly status: ScenarioRunStatus;
  readonly launcher: 'LOCAL_PROCESS' | 'CLOUD_RUN_JOB';
  readonly noise: ScenarioNoiseSettings | null;
  readonly requestedBy: string;
  readonly requestedAt: IsoTimestamp;
  readonly idempotencyKey: string;
  readonly updatedAt: IsoTimestamp;
  /** The Cloud Run execution name, when launched as a job. */
  readonly executionName?: string;
  /** Short, credential-free reason when FAILED. */
  readonly failure?: string;
  readonly finishedAt?: IsoTimestamp;
}

/** Whether this deployment can launch scenarios, and why not when it cannot. */
export interface ScenarioLaunchCapability {
  readonly available: boolean;
  readonly launcher: 'LOCAL_PROCESS' | 'CLOUD_RUN_JOB' | 'DISABLED';
  readonly reason?: string;
}
