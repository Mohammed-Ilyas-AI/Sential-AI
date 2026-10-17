import type { AccountProfile, GraphEdge, GraphNeighbourhood, GraphNode, InstitutionId, IsoTimestamp, Transaction } from '@sentinel/domain';

/** The account's outbound transfers to one destination, summed: one edge in the money trail. */
export interface OwnTransferLink {
  readonly destinationId: string;
  readonly destinationInstitutionId: InstitutionId;
  readonly total: number;
  readonly count: number;
  readonly firstSeen: IsoTimestamp;
  readonly lastSeen: IsoTimestamp;
}

/** Destinations explored beyond the account itself, largest first; the node and edge caps still apply after. */
export const MONEY_TRAIL_DESTINATION_CAP = 5;

/** The account's own outbound transfers grouped by destination, largest total first. Recorded facts only. */
export function ownTransferLinks(accountId: string, transactions: readonly Transaction[]): readonly OwnTransferLink[] {
  const links = new Map<string, OwnTransferLink>();
  for (const transaction of transactions) {
    if (transaction.sourceAccountId !== accountId || transaction.destAccountId === accountId) continue;
    const known = links.get(transaction.destAccountId);
    links.set(transaction.destAccountId, {
      destinationId: transaction.destAccountId,
      destinationInstitutionId: transaction.destInstitutionId,
      total: (known?.total ?? 0) + transaction.amount,
      count: (known?.count ?? 0) + 1,
      firstSeen: known && known.firstSeen < transaction.ts ? known.firstSeen : transaction.ts,
      lastSeen: known && known.lastSeen > transaction.ts ? known.lastSeen : transaction.ts,
    });
  }
  return [...links.values()].sort((left, right) => right.total - left.total).slice(0, MONEY_TRAIL_DESTINATION_CAP);
}

const edgeKey = (edge: GraphEdge): string => `${edge.from}|${edge.to}|${edge.kind}`;

/**
 * Joins the account's own transfers to the network graph. The graph records what the network observed around
 * destinations; the account's own transfers are its bank's direct, confirmed record of where the money went.
 * Together they answer the investigator's question: account → destination (hop 1) → what that destination is
 * linked to (hop 2). Root and destinations come first so the node cap never drops them.
 */
export function joinOwnTransfers(
  account: AccountProfile,
  root: GraphNeighbourhood,
  links: readonly OwnTransferLink[],
  destinationNeighbourhoods: readonly GraphNeighbourhood[],
): GraphNeighbourhood {
  const observed = new Map<string, GraphNode>();
  for (const node of [...root.nodes, ...destinationNeighbourhoods.flatMap((neighbourhood) => neighbourhood.nodes)]) observed.set(node.id, node);

  const nodes = new Map<string, GraphNode>();
  nodes.set(
    account.accountId,
    observed.get(account.accountId) ?? {
      id: account.accountId,
      kind: 'ACCOUNT',
      institutionId: account.institutionId,
      flagged: false,
      riskIndicators: [],
      txCount: links.reduce((sum, link) => sum + link.count, 0),
    },
  );
  for (const link of links) {
    nodes.set(
      link.destinationId,
      observed.get(link.destinationId) ?? {
        id: link.destinationId,
        kind: 'ACCOUNT',
        institutionId: link.destinationInstitutionId,
        flagged: false,
        riskIndicators: [],
        txCount: link.count,
      },
    );
  }
  for (const [id, node] of observed) if (!nodes.has(id)) nodes.set(id, node);

  const edges = new Map<string, GraphEdge>();
  for (const link of links) {
    const edge: GraphEdge = {
      from: account.accountId,
      to: link.destinationId,
      kind: 'TRANSFERRED_TO',
      weight: link.total,
      firstSeen: link.firstSeen,
      lastSeen: link.lastSeen,
      evidence: {
        sourceInstitution: account.institutionId,
        evidenceType: 'PAYMENT_EVENT',
        observedAt: link.lastSeen,
        tenantScope: 'OWN',
        linkage: 'DIRECT',
        scoring: 'CONFIRMED',
      },
    };
    edges.set(edgeKey(edge), edge);
  }
  for (const edge of [...root.edges, ...destinationNeighbourhoods.flatMap((neighbourhood) => neighbourhood.edges)]) {
    if (!edges.has(edgeKey(edge))) edges.set(edgeKey(edge), edge);
  }

  return {
    rootId: account.accountId,
    hopDepth: root.hopDepth,
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    truncated: root.truncated || destinationNeighbourhoods.some((neighbourhood) => neighbourhood.truncated),
  };
}
