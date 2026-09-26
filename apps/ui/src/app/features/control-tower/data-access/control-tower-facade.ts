import type { Signal } from '@angular/core';
import type { DecisionRecord } from '@sentinel/domain';
import type { LiveMetricsView } from '../models/live-metrics-view';

/** What the control-tower page consumes. Pages talk to the facade, never to the store or HTTP directly. */
export abstract class ControlTowerFacade {
  abstract readonly metrics: Signal<LiveMetricsView>;
  abstract readonly activeHold: Signal<DecisionRecord | null>;
}
