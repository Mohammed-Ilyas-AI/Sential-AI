import type { ReferenceScenarioKey } from '../constants/reference-scenarios.constants.js';
import type { Decision } from '../decision/decision.js';
import type { SentinelSwarmReport } from '../intelligence/agent-swarm.js';
import type { RiskBand } from '../risk/risk-assessment.js';
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

/** One transfer the live demo's policy gate held, for the walkthrough to open. */
export interface LiveDemoHold {
  readonly transactionId: string;
  readonly assessmentId: string;
  readonly accountId: string;
  readonly amount: number;
  readonly riskScore: number;
  readonly holdUntil?: IsoTimestamp;
}

/**
 * The in-app live demo (M§6): DEMO_TAKEOVER_01 played through sentinel-core's own control path on fresh,
 * run-scoped synthetic accounts, within one request. Synthetic only; never a real bank or customer.
 */
export interface LiveDemoReport {
  readonly runId: string;
  readonly scenarioId: 'DEMO_TAKEOVER_01';
  readonly startedAt: IsoTimestamp;
  readonly finishedAt: IsoTimestamp;
  readonly transfers: number;
  readonly held: readonly LiveDemoHold[];
}

/** One case of the multi-scam burst: what the gate decided and what the seven agents found. */
export interface MultiScamBurstCase {
  readonly scenario: ReferenceScenarioKey;
  readonly scenarioName: string;
  readonly institutionId: string;
  readonly accountDisplayId: string;
  readonly accountId: string;
  readonly transfers: number;
  /** The case's worst outcome: HOLD if the gate held any of its transfers, otherwise ALLOW. */
  readonly decision: Decision;
  /** The highest score among its transfers, and the assessment that carried it. */
  readonly peakScore: number;
  readonly peakBand: RiskBand;
  readonly assessmentId: string;
  readonly drainPct: number;
  readonly held: readonly LiveDemoHold[];
  /** Present for every case that reached HIGH or CRITICAL, or was held. */
  readonly swarm?: SentinelSwarmReport;
}

/**
 * MULTI_SCAM_BURST_01 played through sentinel-core's control path: twelve concurrent cases across three banks,
 * each decided by the rules and worked by the 7-agent swarm. Synthetic only.
 */
export interface MultiScamBurstReport {
  readonly runId: string;
  readonly scenarioId: 'MULTI_SCAM_BURST_01';
  readonly startedAt: IsoTimestamp;
  readonly finishedAt: IsoTimestamp;
  readonly transfers: number;
  readonly cases: readonly MultiScamBurstCase[];
}
