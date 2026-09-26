import type { RapidDrainPolicy } from '@sentinel/domain';

export interface VertexAiSettings {
  readonly projectId: string;
  readonly location: string;
  /** Model identifiers are configuration, never literals in code; verify available IDs before the demo. */
  readonly fastModel?: string;
  readonly deepModel?: string;
}

export interface CoreRuntimeConfig {
  readonly port: number;
  readonly logLevel: string;
  readonly corsAllowedOrigin: string;
  readonly mongo: { readonly uri: string; readonly database: string };
  readonly vertex: VertexAiSettings;
  readonly rapidDrainPolicy: RapidDrainPolicy;
  readonly designatedBillingPayeeIds: ReadonlySet<string>;
  /** Demo only: the 24h hold reads as 24s and the UI labels it "demo time x3600". */
  readonly demoTimeCompression: boolean;
}
