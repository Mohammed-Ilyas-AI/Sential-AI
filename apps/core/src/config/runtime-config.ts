import type { RapidDrainPolicy } from '@sentinel/domain';

/**
 * Where Gemini is reached from sentinel-core. vertex-ai: Vertex AI with the service account's own credentials.
 * gemini-api: the Gemini API with a key that only ever comes from Secret Manager (GEMINI_API_KEY) and never
 * reaches the browser, a log line or the repository.
 */
export type GeminiProvider = 'vertex-ai' | 'gemini-api';

export interface GeminiSettings {
  readonly provider: GeminiProvider;
  /** gemini-api only. A missing key is not a startup error: the advisory reports MODEL_NOT_CONFIGURED. */
  readonly apiKey?: string;
  /** vertex-ai only. */
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
  readonly gemini: GeminiSettings;
  readonly rapidDrainPolicy: RapidDrainPolicy;
  readonly designatedBillingPayeeIds: ReadonlySet<string>;
  readonly pubsubPush: PubSubPushVerification;
  /** Demo only: the 24h hold reads as 24s and the UI labels it "demo time x3600". */
  readonly demoTimeCompression: boolean;
}
