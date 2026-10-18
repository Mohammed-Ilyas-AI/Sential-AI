import type { ScenarioRun } from '@sentinel/domain';
import type { IdempotentWriteResult } from '../../../../platform/idempotency/idempotent-write.js';

/** `scenario_runs`, unique on idempotencyKey: a retried launch returns the stored run. */
export interface ScenarioRunRepository {
  insert(run: ScenarioRun): Promise<IdempotentWriteResult<ScenarioRun>>;
  findById(runId: string): Promise<ScenarioRun | null>;
  /** LAUNCHING or RUNNING, newest first. */
  findActive(): Promise<readonly ScenarioRun[]>;
  list(limit: number): Promise<readonly ScenarioRun[]>;
  /** Applies a progress update unless the run already finished; returns the stored run. */
  update(runId: string, patch: Pick<ScenarioRun, 'status' | 'updatedAt'> & Partial<Pick<ScenarioRun, 'failure' | 'finishedAt' | 'executionName'>>): Promise<ScenarioRun | null>;
}
