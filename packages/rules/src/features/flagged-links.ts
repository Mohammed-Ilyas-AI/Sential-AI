import { LINKAGE_STRENGTH_ORDER, type EdgeLinkage, type GraphEdge } from '@sentinel/domain';

const strengthOf = (linkage: EdgeLinkage): number => LINKAGE_STRENGTH_ORDER.length - LINKAGE_STRENGTH_ORDER.indexOf(linkage);

const weakerOf = (left: EdgeLinkage, right: EdgeLinkage): EdgeLinkage => (strengthOf(left) <= strengthOf(right) ? left : right);

/**
 * One linkage per flagged entity within two hops of the root. A two-hop path is only as strong as its weakest
 * edge; when several paths reach an entity, the strongest counts. The root itself never counts.
 */
export function flaggedLinksWithinTwoHops(
  rootId: string,
  edges: readonly GraphEdge[],
  flaggedIds: ReadonlySet<string>,
): EdgeLinkage[] {
  const neighboursOf = (id: string) =>
    edges
      .filter((edge) => edge.from === id || edge.to === id)
      .map((edge) => ({ id: edge.from === id ? edge.to : edge.from, linkage: edge.evidence.linkage }));

  const strongest = new Map<string, EdgeLinkage>();
  const consider = (id: string, linkage: EdgeLinkage): void => {
    if (id === rootId) return;
    const current = strongest.get(id);
    if (current === undefined || strengthOf(linkage) > strengthOf(current)) strongest.set(id, linkage);
  };

  for (const first of neighboursOf(rootId)) {
    consider(first.id, first.linkage);
    for (const second of neighboursOf(first.id)) consider(second.id, weakerOf(first.linkage, second.linkage));
  }

  return [...strongest.entries()]
    .filter(([id]) => flaggedIds.has(id))
    .sort(([leftId, left], [rightId, right]) => strengthOf(right) - strengthOf(left) || leftId.localeCompare(rightId))
    .map(([, linkage]) => linkage);
}
