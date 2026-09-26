import type { StreamMessage } from '@sentinel/domain';
import type { Observable } from 'rxjs';

/**
 * The WebSocket to sentinel-stream. RxJS owns this stream in motion; consumers buffer it for 250 ms and hand
 * batches to the transaction worker.
 */
export abstract class RealtimeConnection {
  abstract readonly messages$: Observable<StreamMessage>;
  abstract connect(): void;
  abstract disconnect(): void;
}
