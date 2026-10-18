import type { EdgeLinkage, GraphEdge, GraphNode, NetworkObservation } from '@sentinel/domain';
import { flaggedLinksWithinTwoHops } from '@sentinel/rules';
import type { GraphRepository, StoredGraphNode } from '../../../src/modules/graph/application/ports/graph-repository.port.js';
import type { EntityLinkSource } from '../../../src/modules/risk/application/ports/entity-link-source.port.js';
import type { InMemoryAccountStateRepository } from './in-memory-account-state.repository.js';
import type { InMemoryTransactionStore } from './in-memory-transaction-store.js';

const MOVED: ReadonlySet<string> = new Set(['AUTHORISED', 'SETTLED']);

/** Same reads as MongoGraphRepository, over maps; accounts and transactions are shared with the control path. */
export class InMemoryGraphStore implements GraphRepository, EntityLinkSource {
  private readonly entityNodes = new Map<string, GraphNode>();
  private readonly entityEdges = new Map<string, GraphEdge>();

  constructor(
    private readonly sources: { readonly accounts?: InMemoryAccountStateRepository; readonly transactions?: InMemoryTransactionStore } = {},
  ) {}

  async recordObservation(observation: NetworkObservation): Promise<void> {
    for (const node of observation.nodes) this.entityNodes.set(node.id, node);
    for (const edge of observation.edges) this.entityEdges.set(`${edge.from}|${edge.to}|${edge.kind}`, edge);
  }

  snapshot(): { readonly nodes: readonly GraphNode[]; readonly edges: readonly GraphEdge[] } {
    return { nodes: [...this.entityNodes.values()], edges: [...this.entityEdges.values()] };
  }

  async flaggedLinksFor(destinationToken: string): Promise<readonly EdgeLinkage[]> {
    const flagged = new Set([...this.entityNodes.values()].filter((node) => node.flagged).map((node) => node.id));
    return flaggedLinksWithinTwoHops(destinationToken, [...this.entityEdges.values()], flagged);
  }

  async edgesTouching(ids: readonly string[], limit: number): Promise<readonly GraphEdge[]> {
    const wanted = new Set(ids);
    return [...this.entityEdges.values()]
      .filter((edge) => wanted.has(edge.from) || wanted.has(edge.to))
      .sort((left, right) => right.weight - left.weight)
      .slice(0, limit);
  }

  async transfersFrom(ids: readonly string[]): Promise<readonly GraphEdge[]> {
    const wanted = new Set(ids);
    return [...this.entityEdges.values()].filter((edge) => edge.kind === 'TRANSFERRED_TO' && wanted.has(edge.from));
  }

  async ownTransfersFrom(accountId: string): Promise<readonly GraphEdge[]> {
    const moved = (this.sources.transactions?.allProjections() ?? []).filter(
      (projection) => projection.sourceAccountId === accountId && MOVED.has(projection.status),
    );
    const byDestination = new Map<string, typeof moved>();
    for (const projection of moved) byDestination.set(projection.destAccountId, [...(byDestination.get(projection.destAccountId) ?? []), projection]);
    return [...byDestination.entries()].map(([destination, transfers]): GraphEdge => {
      const times = transfers.map((transfer) => transfer.ts).sort();
      const firstSeen = times[0] ?? '';
      const lastSeen = times.at(-1) ?? firstSeen;
      return {
        from: accountId,
        to: destination,
        kind: 'TRANSFERRED_TO',
        weight: transfers.reduce((total, transfer) => total + transfer.amount, 0),
        firstSeen,
        lastSeen,
        evidence: {
          sourceInstitution: transfers[0]?.institutionId ?? '',
          evidenceType: 'PAYMENT_EVENT',
          observedAt: lastSeen,
          tenantScope: 'OWN',
          linkage: 'DIRECT',
          scoring: 'CONFIRMED',
        },
      };
    });
  }

  async nodes(ids: readonly string[]): Promise<readonly StoredGraphNode[]> {
    const result: StoredGraphNode[] = [];
    for (const id of ids) {
      const account = await this.sources.accounts?.findAccount(id);
      const entity = this.entityNodes.get(id);
      const reference = account?.displayReference ? { displayReference: account.displayReference } : {};
      if (entity) {
        result.push({ ...entity, ...reference });
        continue;
      }
      if (!account) {
        const inbound = (this.sources.transactions?.allProjections() ?? []).filter((projection) => projection.destAccountId === id);
        const institutionId = inbound[0]?.destInstitutionId;
        if (institutionId) result.push({ id, kind: 'ACCOUNT', institutionId, flagged: false, riskIndicators: [], txCount: inbound.length });
        continue;
      }
      const txCount = (this.sources.transactions?.allProjections() ?? []).filter((projection) => projection.sourceAccountId === id).length;
      result.push({ id, kind: 'ACCOUNT', institutionId: account.institutionId, flagged: false, riskIndicators: [], txCount, ...reference });
    }
    return result;
  }
}
