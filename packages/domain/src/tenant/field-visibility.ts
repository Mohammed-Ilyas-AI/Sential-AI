import type { InstitutionId } from './tenant-identifiers.js';

/**
 * The institution whose analyst is looking (the tenant lens, M§7 stretch; T§14). `null` is the single
 * demonstration deployment's operator view over synthetic data: nothing is projected away.
 *
 * Designed as a multi-tenant platform; demonstrated as a single deployment on synthetic data. The lens is a
 * projection of API and stream responses, not tenant isolation: there is no per-tenant identity provider yet.
 */
export type TenantLens = InstitutionId | null;

/** The institutions the prototype simulates; a lens outside this list is refused. */
export const SYNTHETIC_INSTITUTIONS: readonly InstitutionId[] = ['BANK_A', 'BANK_B', 'BANK_C'];

/** The lens header the UI sends to sentinel-core, and the query parameter it sends to sentinel-stream. */
export const TENANT_LENS_HEADER = 'x-sentinel-lens';
export const TENANT_LENS_QUERY_PARAMETER = 'lens';

/** T§14 field-level visibility, other tenant (network view). Own tenant sees every field. */
export const OTHER_TENANT_VISIBILITY = {
  accountDisplay: 'MASKED',
  customerIdentity: 'NEVER',
  transactionHistory: 'RELATIONSHIP_ONLY',
  riskIndicator: 'BAND_ONLY',
  pathPosition: 'HOP_COUNT',
} as const;

const MASK = '••••';
const VISIBLE_SUFFIX = 4;

/** True when the lens may see the record in full: the operator view, or the record's own institution. */
export function isOwnTenant(lens: TenantLens, institutionId: InstitutionId | undefined): boolean {
  return lens === null || (institutionId !== undefined && institutionId === lens);
}

/** `••••4921`: the last four alphanumerics of a reference or token, never the rest. */
export function maskedReference(value: string): string {
  const visible = value.replace(/[^A-Za-z0-9]/g, '').slice(-VISIBLE_SUFFIX);
  return `${MASK}${visible}`;
}

/** Parses a lens from a header or query value. `undefined` (absent) is the operator view; anything unknown is an error. */
export function parseTenantLens(value: string | undefined): TenantLens | 'INVALID' {
  if (value === undefined || value === '') return null;
  const normalised = value.trim().toUpperCase();
  return SYNTHETIC_INSTITUTIONS.includes(normalised) ? normalised : 'INVALID';
}
