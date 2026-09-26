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
}

interface FlaggedEntity {
  readonly id: string;
  readonly kind: NodeKind;
  readonly institutionId: InstitutionId;
  readonly edgeKind: GraphEdgeKind;
  readonly evidenceType: EdgeEvidenceType;
  readonly riskIndicators: readonly string[];
}

/** The reference's mules across the three banks, a network-authorised shared device, a correlated beneficiary. */
const CONFIRMED_MULES: readonly FlaggedEntity[] = [
  { id: syntheticToken('acct', 'ACC-55902'), kind: 'ACCOUNT', institutionId: 'BANK_B', edgeKind: 'TRANSFERRED_TO', evidenceType: 'PAYMENT_EVENT', riskIndicators: ['RAPID_MOVEMENT'] },
  { id: syntheticToken('acct', 'ACC-47219'), kind: 'ACCOUNT', institutionId: 'BANK_C', edgeKind: 'TRANSFERRED_TO', evidenceType: 'PAYMENT_EVENT', riskIndicators: ['RAPID_MOVEMENT'] },
  { id: syntheticToken('acct', 'ACC-20441'), kind: 'ACCOUNT', institutionId: 'BANK_A', edgeKind: 'TRANSFERRED_TO', evidenceType: 'PAYMENT_EVENT', riskIndicators: ['MULTI_BENEFICIARY'] },
];
const SHARED_DEVICE: FlaggedEntity = {
  id: syntheticToken('dev', 'DEV-SHARED-01'),
  kind: 'DEVICE',
  institutionId: 'BANK_B',
  edgeKind: 'USED_DEVICE',
  evidenceType: 'NETWORK_DEVICE_RELATIONSHIP',
  riskIndicators: ['SHARED_ACROSS_INSTITUTIONS'],
};
const CORRELATED_BENEFICIARY: FlaggedEntity = {
  id: syntheticToken('ben', 'PAYEE-5121'),
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
    const root = syntheticToken('acct', input.destinationPayeeId);
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
      nodes.push({ id: entity.id, kind: entity.kind, institutionId: entity.institutionId, flagged: true, riskIndicators: entity.riskIndicators, txCount: 3 });
      return {
        from: root,
        to: entity.id,
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
