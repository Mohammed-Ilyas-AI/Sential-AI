import type { StreamMessage } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';
import type { WatchedCollection } from '../change-stream/change-feed.js';

export interface RawChange {
  readonly collection: WatchedCollection;
  readonly document: unknown;
  readonly resumeToken: unknown;
}

/** Maps a raw change into the shared domain StreamMessage contract; the browser never sees a Mongo shape. */
export type NormaliseChange = (change: RawChange) => StreamMessage | null;

export const normaliseChange: NormaliseChange = () => {
  throw new NotYetImplementedError('Stream message normalisation', 'scheduled for build order step 4');
};
