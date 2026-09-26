import type { NetworkObservation } from '@sentinel/domain';

/** Tokenised, permitted nodes and edges from participating institutions; idempotent upsert. */
export interface RecordNetworkObservation {
  record(observation: NetworkObservation): Promise<void>;
}
