import type { FundTraceView, GraphHopDepth, NetworkExploration, TenantLens } from '@sentinel/domain';

/**
 * Edge provenance comes from the record, never from Gemini; a trace ends at the observed boundary. Every response
 * is projected through the tenant lens before it leaves the server.
 */
export interface ExploreNetwork {
  neighbourhood(rootId: string, hopDepth: GraphHopDepth, lens: TenantLens): Promise<NetworkExploration>;
  /** Follows the heaviest observed outflow at each hop; `via` fixes the first hop to one chosen destination. */
  traceFunds(rootId: string, lens: TenantLens, via?: string): Promise<FundTraceView>;
}
