import type { MinorUnits } from '../money/minor-units.js';
import type { TenantId } from './tenant-identifiers.js';

export type ConnectorMode = 'DECISION_API' | 'EVENT_STREAM' | 'WEBHOOK' | 'BATCH';

/** Chosen by the bank and applied when SENTINEL is unreachable. */
export type TenantFallbackPolicy = 'ALLOW' | 'QUEUE' | 'LOCAL_RULE';

/**
 * Production tenancy contract (T§14). Designed, not built: the prototype uses it only for the
 * stretch tenant lens over synthetic data.
 */
export interface TenantConfig {
  readonly tenantId: TenantId;
  readonly branding: { readonly logo: string; readonly primary: string; readonly accent: string };
  readonly policies: {
    readonly rapidDrain: {
      readonly protectedBalance: MinorUnits;
      readonly gatePct: number;
      readonly holdHours: number;
    };
  };
  readonly identity: { readonly provider: 'SAML' | 'OIDC'; readonly issuer: string };
  readonly retentionDays: number;
  readonly connectors: readonly ConnectorMode[];
  readonly fallback: TenantFallbackPolicy;
}
