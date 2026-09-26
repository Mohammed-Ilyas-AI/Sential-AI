import type { InstitutionId } from '../tenant/tenant-identifiers.js';
import type { IsoTimestamp } from '../time/iso-timestamp.js';

export type EdgeEvidenceType = 'PAYMENT_EVENT' | 'AUTH_EVENT' | 'NETWORK_DEVICE_RELATIONSHIP' | 'BENEFICIARY_MATCH';

export type EdgeTenantScope = 'OWN' | 'NETWORK';

/** DIRECT is one bank's own record; the rest are cross-bank linkages, strongest first. */
export type EdgeLinkage = 'DIRECT' | 'NETWORK_REFERENCE' | 'NETWORK_TOKEN' | 'CORRELATED' | 'UNOBSERVED';

export type EdgeScoring = 'CONFIRMED' | 'STRONG' | 'CANDIDATE' | 'NONE';

/** Every graph edge says why it exists and whether it may score. */
export interface EdgeEvidence {
  readonly sourceInstitution: InstitutionId;
  readonly evidenceType: EdgeEvidenceType;
  readonly networkReference?: string;
  readonly observedAt: IsoTimestamp;
  readonly tenantScope: EdgeTenantScope;
  readonly linkage: EdgeLinkage;
  readonly scoring: EdgeScoring;
}
