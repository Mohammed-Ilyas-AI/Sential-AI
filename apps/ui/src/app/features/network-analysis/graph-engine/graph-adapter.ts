import type { FundTrace, GraphNeighbourhood } from '@sentinel/domain';
import type { GraphScene } from '../models/graph-scene';

/** Domain graph to scene. Provenance travels with every edge; an unobserved boundary becomes its own node. */
export abstract class GraphAdapter {
  abstract toScene(neighbourhood: GraphNeighbourhood, trace?: FundTrace): GraphScene;
}
