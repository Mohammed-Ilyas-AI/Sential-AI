import {
  LINKAGE_SCORING,
  type EdgeEvidenceType,
  type EdgeLinkage,
  type GraphEdge,
  type GraphEdgeKind,
  type GraphNode,
  type InstitutionId,
  type NetworkObservation,
  type NodeKind,
} from '@sentinel/domain';
import { syntheticToken } from '../identity/synthetic-token.js';
import type { ScenarioGenerator } from './scenario-generator.js';

export interface MuleNetworkInput {
  readonly destinationPayeeId: string;
  readonly destinationInstitutionId: InstitutionId;
  readonly flaggedLinks: readonly EdgeLinkage[];
  readonly observedAt: string;
  /** The run's tokeniser, so the network links the same synthetic accounts the run transacts with. */
  readonly token?: (prefix: 'acct' | 'dev' | 'ben', identifier: string) => string;
}

interface FlaggedEntity {
  /** A display identifier, tokenised per run when the observation is generated. */
  readonly id: string;
  readonly prefix: 'acct' | 'dev' | 'ben';
  readonly kind: NodeKind;
  readonly institutionId: InstitutionId;
  readonly edgeKind: GraphEdgeKind;
  readonly evidenceType: EdgeEvidenceType;
  readonly riskIndicators: readonly string[];
}

/** The reference's mules across the three banks, a network-authorised shared device, a correlated beneficiary. */
const CONFIRMED_MULES: readonly FlaggedEntity[] = [
  { id: 'ACC-55902', prefix: 'acct', kind: 'ACCOUNT', institutionId: 'BANK_B', edgeKind: 'TRANSFERRED_TO', evidenceType: 'PAYMENT_EVENT', riskIndicators: ['RAPID_MOVEMENT'] },
  { id: 'ACC-47219', prefix: 'acct', kind: 'ACCOUNT', institutionId: 'BANK_C', edgeKind: 'TRANSFERRED_TO', evidenceType: 'PAYMENT_EVENT', riskIndicators: ['RAPID_MOVEMENT'] },
  { id: 'ACC-20441', prefix: 'acct', kind: 'ACCOUNT', institutionId: 'BANK_A', edgeKind: 'TRANSFERRED_TO', evidenceType: 'PAYMENT_EVENT', riskIndicators: ['MULTI_BENEFICIARY'] },
];
const SHARED_DEVICE: FlaggedEntity = {
  id: 'DEV-SHARED-01',
  prefix: 'dev',
  kind: 'DEVICE',
  institutionId: 'BANK_B',
  edgeKind: 'USED_DEVICE',
  evidenceType: 'NETWORK_DEVICE_RELATIONSHIP',
  riskIndicators: ['SHARED_ACROSS_INSTITUTIONS'],
};
const CORRELATED_BENEFICIARY: FlaggedEntity = {
  id: 'PAYEE-5121',
  prefix: 'ben',
  kind: 'PAYEE',
  institutionId: 'BANK_C',
  edgeKind: 'PAYEE_OF',
  evidenceType: 'BENEFICIARY_MATCH',
  riskIndicators: ['MULTI_BENEFICIARY'],
};

/**
 * The cross-institution neighbourhood of the final payee's destination: one flagged entity per linkage, each
 * edge carrying its provenance. Tokens only; synthetic; never a raw fingerprint.
 */
export const muleNetworkGenerator: ScenarioGenerator<MuleNetworkInput, NetworkObservation> = {
  name: 'mule-network',
  generate(_random, input) {
    const token = input.token ?? syntheticToken;
    const root = token('acct', input.destinationPayeeId);
    const mules = [...CONFIRMED_MULES];
    const entityFor = (linkage: EdgeLinkage): FlaggedEntity => {
      if (linkage === 'NETWORK_TOKEN') return SHARED_DEVICE;
      if (linkage === 'CORRELATED' || linkage === 'UNOBSERVED') return CORRELATED_BENEFICIARY;
      const mule = mules.shift();
      if (!mule) throw new Error('The synthetic network has no more confirmed mules to link');
      return mule;
    };

    const nodes: GraphNode[] = [
      { id: root, kind: 'ACCOUNT', institutionId: input.destinationInstitutionId, flagged: false, riskIndicators: [], txCount: 1 },
    ];
    const edges: GraphEdge[] = input.flaggedLinks.map((linkage, index) => {
      const entity = entityFor(linkage);
      const entityToken = token(entity.prefix, entity.id);
      nodes.push({ id: entityToken, kind: entity.kind, institutionId: entity.institutionId, flagged: true, riskIndicators: entity.riskIndicators, txCount: 3 });
      return {
        from: root,
        to: entityToken,
        kind: entity.edgeKind,
        weight: entity.edgeKind === 'TRANSFERRED_TO' ? 900_000 : 1,
        firstSeen: input.observedAt,
        lastSeen: input.observedAt,
        evidence: {
          sourceInstitution: entity.institutionId,
          evidenceType: entity.evidenceType,
          ...(linkage === 'NETWORK_REFERENCE' ? { networkReference: `FAST-3H8P-77${19 + index}` } : {}),
          observedAt: input.observedAt,
          tenantScope: 'NETWORK',
          linkage,
          scoring: LINKAGE_SCORING[linkage],
        },
      };
    });
    return { schemaVersion: '1.0', nodes, edges };
  },
};
