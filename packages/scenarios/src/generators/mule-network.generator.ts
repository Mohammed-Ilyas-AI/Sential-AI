import type { GraphEdge, GraphNode } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';
import type { ScenarioGenerator } from './scenario-generator.js';

export interface SyntheticNetworkSeed {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

/**
 * The cross-institution fan-out and consolidation structure (SYNTHETIC_MULE_NETWORK). Mules are linked
 * across institutions by network-authorised device relationships, never raw fingerprints.
 */
export const muleNetworkGenerator: ScenarioGenerator<SyntheticNetworkSeed> = {
  name: 'mule-network',
  generate() {
    throw new NotYetImplementedError('Mule network generator', 'scheduled for build order step 11');
  },
};
