import { LINKAGE_SCORING, type GraphEdge, type GraphNode, type NetworkObservation } from '@sentinel/domain';
import type { RequestBodyValidator } from '../../../api/middleware/request-validation.middleware.js';
import { FieldReader, toValidationResult } from '../../../api/validation/field-reader.js';

const NODE_KINDS = ['ACCOUNT', 'PAYEE', 'DEVICE', 'INSTITUTION'] as const;
const EDGE_KINDS = ['TRANSFERRED_TO', 'USED_DEVICE', 'PAYEE_OF', 'HELD_AT'] as const;
const EVIDENCE_TYPES = ['PAYMENT_EVENT', 'AUTH_EVENT', 'NETWORK_DEVICE_RELATIONSHIP', 'BENEFICIARY_MATCH'] as const;
const LINKAGES = ['DIRECT', 'NETWORK_REFERENCE', 'NETWORK_TOKEN', 'CORRELATED', 'UNOBSERVED'] as const;
const SCORINGS = ['CONFIRMED', 'STRONG', 'CANDIDATE', 'NONE'] as const;
const SCOPES = ['OWN', 'NETWORK'] as const;

function readNode(reader: FieldReader): GraphNode {
  const institutionId = reader.optionalString('institutionId');
  return {
    id: reader.token('id'),
    kind: reader.oneOf('kind', NODE_KINDS),
    ...(institutionId ? { institutionId } : {}),
    flagged: reader.boolean('flagged'),
    riskIndicators: reader.tokenArray('riskIndicators'),
    txCount: reader.integer('txCount', 0),
  };
}

function readEdge(reader: FieldReader): GraphEdge {
  const evidence = reader.object('evidence');
  const networkReference = evidence.optionalString('networkReference');
  const linkage = evidence.oneOf('linkage', LINKAGES);
  const scoring = evidence.oneOf('scoring', SCORINGS);
  if (LINKAGE_SCORING[linkage] !== scoring) evidence.reject('scoring', `${LINKAGE_SCORING[linkage]} for ${linkage}`);
  return {
    from: reader.token('from'),
    to: reader.token('to'),
    kind: reader.oneOf('kind', EDGE_KINDS),
    weight: reader.number('weight', 0),
    firstSeen: reader.timestamp('firstSeen'),
    lastSeen: reader.timestamp('lastSeen'),
    evidence: {
      sourceInstitution: evidence.string('sourceInstitution'),
      evidenceType: evidence.oneOf('evidenceType', EVIDENCE_TYPES),
      ...(networkReference ? { networkReference } : {}),
      observedAt: evidence.timestamp('observedAt'),
      tenantScope: evidence.oneOf('tenantScope', SCOPES),
      linkage,
      scoring,
    },
  };
}

/** Every edge must state its provenance, and its scoring must agree with its linkage. */
export const networkObservationValidator: RequestBodyValidator<NetworkObservation> = (body) => {
  const { reader, problems } = FieldReader.forBody(body);
  const observation: NetworkObservation = {
    schemaVersion: reader.literal('schemaVersion', '1.0'),
    nodes: reader.objectArray('nodes').map(readNode),
    edges: reader.objectArray('edges').map(readEdge),
  };
  return toValidationResult(problems, observation);
};
