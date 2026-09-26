import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import type { StreamClientMessage, StreamMessage } from '@sentinel/domain';
import { defer, retry, share, timer, type Observable } from 'rxjs';
import { webSocket } from 'rxjs/webSocket';
import { SessionActions } from '../../../state/session/session.actions';
import { RUNTIME_CONFIG } from '../../config/runtime-config';
import { EXPONENTIAL_RECONNECT } from '../reconnect/reconnect-policy';
import { RealtimeConnection } from './realtime-connection';

/**
 * The WebSocket to sentinel-stream. On every (re)connect the server sends a fresh snapshot, so the client
 * holds nothing it cannot rebuild; drops are retried with backoff.
 */
@Injectable()
export class WebSocketRealtimeConnection extends RealtimeConnection {
  private readonly config = inject(RUNTIME_CONFIG);
  private readonly store = inject(Store);

  readonly messages$: Observable<StreamMessage> = defer(() =>
    webSocket<StreamMessage | StreamClientMessage>({
      url: this.config.streamUrl,
      openObserver: { next: () => this.store.dispatch(SessionActions.streamStatusChanged({ status: 'LIVE' })) },
      closeObserver: { next: () => this.store.dispatch(SessionActions.streamStatusChanged({ status: 'RECONNECTING' })) },
    }) as Observable<StreamMessage>,
  ).pipe(
    retry({ delay: (_error, attempt) => timer(EXPONENTIAL_RECONNECT.delayForAttempt(attempt)) }),
    share(),
  );
}
