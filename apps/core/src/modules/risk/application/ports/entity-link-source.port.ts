import type { EdgeLinkage } from '@sentinel/domain';

/**
 * One linkage per flagged entity within two hops of a destination. Read-only access to the network graph for
 * the ENTITY_LINK feature; the control path never imports the graph module.
 */
export interface EntityLinkSource {
  flaggedLinksFor(destinationToken: string): Promise<readonly EdgeLinkage[]>;
}
