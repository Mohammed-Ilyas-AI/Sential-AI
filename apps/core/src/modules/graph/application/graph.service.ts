import type { FundTrace, GraphNeighbourhood } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';
import type { ExploreNetwork } from './explore-network.use-case.js';
import type { GraphRepository } from './ports/graph-repository.port.js';

export class GraphService implements ExploreNetwork {
  constructor(private readonly graph: GraphRepository) {}

  neighbourhood(): Promise<GraphNeighbourhood> {
    throw new NotYetImplementedError('Graph neighbourhood', 'scheduled for build order step 11');
  }

  traceFunds(): Promise<FundTrace> {
    throw new NotYetImplementedError('Fund trace', 'scheduled for build order step 11');
  }
}
