import type { FundTrace, GraphHopDepth, GraphNeighbourhood } from '@sentinel/domain';

/** `entities` and `entity_edges`; every edge carries its EdgeEvidence. */
export interface GraphRepository {
  neighbourhood(rootId: string, hopDepth: GraphHopDepth): Promise<GraphNeighbourhood>;
  traceFunds(rootId: string): Promise<FundTrace>;
}
