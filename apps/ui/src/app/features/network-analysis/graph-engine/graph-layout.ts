import type { Observable } from 'rxjs';
import type { GraphScene, PositionedGraphScene } from '../models/graph-scene';

/** Force-directed layout, run in its own worker so dragging a node never stutters the tape. */
export abstract class GraphLayout {
  abstract layout(scene: GraphScene): Observable<PositionedGraphScene>;
}
