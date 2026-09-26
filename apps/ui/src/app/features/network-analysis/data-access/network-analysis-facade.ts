import type { Signal } from '@angular/core';
import type { GraphHopDepth, TraceObservability } from '@sentinel/domain';
import type { PositionedGraphScene } from '../models/graph-scene';

export abstract class NetworkAnalysisFacade {
  abstract readonly scene: Signal<PositionedGraphScene | null>;
  /** "Observed 3 hops. Downstream activity unavailable beyond Bank C." */
  abstract readonly observability: Signal<TraceObservability | null>;
  abstract open(rootId: string, hopDepth: GraphHopDepth): void;
  abstract traceFunds(rootId: string): void;
}
