import { isOwnTenant, maskedReference, type GraphEdge, type NetworkEdgeView, type NetworkNodeView, type TenantLens } from '@sentinel/domain';
import type { StoredGraphNode } from './ports/graph-repository.port.js';

export const edgeIdOf = (edge: Pick<GraphEdge, 'from' | 'to' | 'kind'>): string => `${edge.from}|${edge.to}|${edge.kind}`;

/**
 * T§14 for a node: the lens's own institution sees everything; another tenant's node keeps its kind,
 * institution, flag and hop count, with the reference masked and indicators and transaction count withheld.
 * A node whose institution is unknown is treated as another tenant's.
 */
export function projectNode(lens: TenantLens, node: StoredGraphNode, hops: number): NetworkNodeView {
  const reference = node.displayReference ?? node.id;
  if (isOwnTenant(lens, node.institutionId)) {
    return {
      id: node.id,
      kind: node.kind,
      ...(node.institutionId ? { institutionId: node.institutionId } : {}),
      label: reference,
      flagged: node.flagged,
      riskIndicators: node.riskIndicators,
      txCount: node.txCount,
      hops,
      masked: false,
    };
  }
  return {
    id: node.id,
    kind: node.kind,
    ...(node.institutionId ? { institutionId: node.institutionId } : {}),
    label: maskedReference(reference),
    flagged: node.flagged,
    riskIndicators: [],
    txCount: null,
    hops,
    masked: true,
  };
}

/** T§14 for an edge: the provenance is always shown; another institution's value moved is withheld. */
export function projectEdge(lens: TenantLens, edge: GraphEdge): NetworkEdgeView {
  const own = isOwnTenant(lens, edge.evidence.sourceInstitution);
  return { ...edge, id: edgeIdOf(edge), weight: own ? edge.weight : null, masked: !own };
}
