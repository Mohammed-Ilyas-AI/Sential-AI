import type { StreamMessage } from '@sentinel/domain';

/** The live tape is sourced from decisions; alerts and interventions drive the queue and the hold panel. */
export const WATCHED_COLLECTIONS = ['decisions', 'alerts', 'interventions'] as const;

export type WatchedCollection = (typeof WATCHED_COLLECTIONS)[number];

/** Normalised change events, in commit order, each carrying a resumable global cursor. */
export interface ChangeFeed {
  messages(resumeFrom?: string): AsyncIterable<StreamMessage>;
  close(): Promise<void>;
}
