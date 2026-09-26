import type { FundTrace, GraphNeighbourhood, NetworkObservation } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';
import type { ExploreNetwork } from './explore-network.use-case.js';
import type { GraphRepository } from './ports/graph-repository.port.js';
import type { RecordNetworkObservation } from './record-network-observation.use-case.js';

export class GraphService implements ExploreNetwork, RecordNetworkObservation {
  constructor(private readonly graph: GraphRepository) {}

  record(observation: NetworkObservation): Promise<void> {
    return this.graph.recordObservation(observation);
  }

  neighbourhood(): Promise<GraphNeighbourhood> {
    throw new NotYetImplementedError('Graph neighbourhood', 'scheduled for build order step 11');
  }

  traceFunds(): Promise<FundTrace> {
    throw new NotYetImplementedError('Fund trace', 'scheduled for build order step 11');
  }
}
