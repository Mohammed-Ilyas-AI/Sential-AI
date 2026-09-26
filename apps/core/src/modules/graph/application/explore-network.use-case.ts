import type { FundTrace, GraphHopDepth, GraphNeighbourhood } from '@sentinel/domain';

/** Edge provenance comes from the record, never from Gemini; a trace ends at the observed boundary. */
export interface ExploreNetwork {
  neighbourhood(rootId: string, hopDepth: GraphHopDepth): Promise<GraphNeighbourhood>;
  traceFunds(rootId: string): Promise<FundTrace>;
}
