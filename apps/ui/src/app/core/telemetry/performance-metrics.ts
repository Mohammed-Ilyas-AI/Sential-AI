import type { Signal } from '@angular/core';

/** The live numbers behind the performance panel (T§5): measured, not asserted. */
export interface PerformanceSample {
  readonly eventsPerSecond: number;
  readonly mainThreadMsPerBatch: number;
  readonly messageToRowMs: number;
  readonly changeDetectionPassesPerSecond: number;
}

export abstract class PerformanceMetrics {
  abstract readonly latest: Signal<PerformanceSample | null>;
}
