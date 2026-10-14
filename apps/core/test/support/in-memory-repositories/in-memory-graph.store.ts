import type { EdgeLinkage, FundTrace, GraphEdge, GraphNeighbourhood, GraphNode, NetworkObservation } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';
import { flaggedLinksWithinTwoHops } from '@sentinel/rules';
import type { GraphRepository } from '../../../src/modules/graph/application/ports/graph-repository.port.js';
import type { EntityLinkSource } from '../../../src/modules/risk/application/ports/entity-link-source.port.js';

export class InMemoryGraphStore implements GraphRepository, EntityLinkSource {
  private readonly nodes = new Map<string, GraphNode>();
  private readonly edges = new Map<string, GraphEdge>();

  async recordObservation(observation: NetworkObservation): Promise<void> {
    for (const node of observation.nodes) this.nodes.set(node.id, node);
    for (const edge of observation.edges) this.edges.set(`${edge.from}|${edge.to}|${edge.kind}`, edge);
  }

  snapshot(): { readonly nodes: readonly GraphNode[]; readonly edges: readonly GraphEdge[] } {
    return { nodes: [...this.nodes.values()], edges: [...this.edges.values()] };
  }

  async flaggedLinksFor(destinationToken: string): Promise<readonly EdgeLinkage[]> {
    const flagged = new Set([...this.nodes.values()].filter((node) => node.flagged).map((node) => node.id));
    return flaggedLinksWithinTwoHops(destinationToken, [...this.edges.values()], flagged);
  }

  neighbourhood(): Promise<GraphNeighbourhood> {
    throw new NotYetImplementedError('In-memory graph neighbourhood', 'scheduled for build order step 11');
  }

  traceFunds(): Promise<FundTrace> {
    throw new NotYetImplementedError('In-memory fund trace', 'scheduled for build order step 11');
  }
}
