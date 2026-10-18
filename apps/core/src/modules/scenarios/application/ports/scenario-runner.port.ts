import type { IsoTimestamp, ScenarioLaunchCapability, ScenarioNoiseSettings, ScenarioRunStatus } from '@sentinel/domain';

export interface ScenarioLaunchRequest {
  readonly runId: string;
  readonly noise: ScenarioNoiseSettings | null;
}

export interface ScenarioRunUpdate {
  readonly status: Exclude<ScenarioRunStatus, 'LAUNCHING'>;
  readonly at: IsoTimestamp;
  /** Short and credential-free: never a log line, an environment value or a token. */
  readonly failure?: string;
}

/**
 * Starts the existing simulator for one run. Implementations hold no browser-supplied command or credential: the
 * run ID and bounded noise settings are the only inputs.
 */
export interface ScenarioRunner {
  readonly capability: ScenarioLaunchCapability;
  /** Resolves once the run has been handed over; later progress arrives through `onUpdate` or `status`. */
  launch(request: ScenarioLaunchRequest, onUpdate: (update: ScenarioRunUpdate) => Promise<void>): Promise<{ readonly executionName?: string }>;
  /** Current state for a run this runner can still observe, or null when it can no longer tell. */
  status(runId: string, executionName: string | undefined): Promise<ScenarioRunUpdate | null>;
}
