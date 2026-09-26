import type { FundTrace, GraphHopDepth, GraphNeighbourhood, NetworkObservation } from '@sentinel/domain';

/** `entities` and `entity_edges`; every edge carries its EdgeEvidence. */
export interface GraphRepository {
  recordObservation(observation: NetworkObservation): Promise<void>;
  neighbourhood(rootId: string, hopDepth: GraphHopDepth): Promise<GraphNeighbourhood>;
  traceFunds(rootId: string): Promise<FundTrace>;
}
