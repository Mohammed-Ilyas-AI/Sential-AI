import type { ScenarioTimeline } from '@sentinel/scenarios';

/** Replays steps at their documented offsets from the moment the run starts. */
export class RealTimeScenarioTimeline implements ScenarioTimeline {
  private readonly startedAt = Date.now();

  constructor(private readonly sleep: (milliseconds: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms))) {}

  async waitUntil(atMs: number): Promise<void> {
    const remaining = this.startedAt + atMs - Date.now();
    if (remaining > 0) await this.sleep(remaining);
  }
}
