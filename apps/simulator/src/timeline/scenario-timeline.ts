import type { ScenarioStep } from '@sentinel/scenarios';

/** Replays steps at their atMs offsets. The scenario itself never reads the wall clock. */
export interface ScenarioTimeline {
  play(steps: readonly ScenarioStep[], onStep: (step: ScenarioStep) => Promise<void>): Promise<void>;
}
