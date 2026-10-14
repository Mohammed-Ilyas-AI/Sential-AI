import type { RapidDrainPolicy } from '@sentinel/domain';

export interface VertexAiSettings {
  readonly projectId: string;
  readonly location: string;
  /** Model identifiers are configuration, never literals in code; verify available IDs before the demo. */
  readonly fastModel?: string;
  readonly deepModel?: string;
}

/** Pub/Sub push requests are verified as Google-signed OIDC tokens; only local development may switch it off. */
export type PubSubPushVerification =
  | { readonly mode: 'google-oidc'; readonly audience: string; readonly serviceAccountEmail: string }
  | { readonly mode: 'disabled-for-local-development' };

export interface CoreRuntimeConfig {
  readonly port: number;
  readonly logLevel: string;
  /** Exact browser origins allowed to call the API (one deployment may serve the UI under several addresses). */
  readonly corsAllowedOrigins: readonly string[];
  readonly mongo: { readonly uri: string; readonly database: string };
  readonly vertex: VertexAiSettings;
  readonly rapidDrainPolicy: RapidDrainPolicy;
  readonly designatedBillingPayeeIds: ReadonlySet<string>;
  readonly pubsubPush: PubSubPushVerification;
  /** Demo only: the 24h hold reads as 24s and the UI labels it "demo time x3600". */
  readonly demoTimeCompression: boolean;
}
