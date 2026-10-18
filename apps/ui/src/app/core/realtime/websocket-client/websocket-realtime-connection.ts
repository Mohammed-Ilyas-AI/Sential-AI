import { Injectable, inject } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { Store } from "@ngrx/store";
import {
  TENANT_LENS_QUERY_PARAMETER,
  type StreamClientMessage,
  type StreamMessage,
  type TenantLens,
} from "@sentinel/domain";
import {
  defer,
  distinctUntilChanged,
  retry,
  share,
  switchMap,
  timer,
  type Observable,
} from "rxjs";
import { webSocket } from "rxjs/webSocket";
import { SessionActions } from "../../../state/session/session.actions";
import { RUNTIME_CONFIG } from "../../config/runtime-config";
import { TenantLensPreference } from "../../tenancy/tenant-lens";
import { EXPONENTIAL_RECONNECT } from "../reconnect/reconnect-policy";
import { RealtimeConnection } from "./realtime-connection";

/**
 * The WebSocket to sentinel-stream. On every (re)connect the server sends a fresh snapshot, so the client
 * holds nothing it cannot rebuild; drops are retried with backoff. A change of data lens reconnects with the new
 * lens, and the server's snapshot for that lens replaces everything the client held.
 */
@Injectable()
export class WebSocketRealtimeConnection extends RealtimeConnection {
  private readonly config = inject(RUNTIME_CONFIG);
  private readonly store = inject(Store);

  private readonly lens = inject(TenantLensPreference).lens;

  readonly messages$: Observable<StreamMessage> = toObservable(this.lens).pipe(
    distinctUntilChanged(),
    switchMap((lens) => this.connect(lens)),
    share(),
  );

  private connect(lens: TenantLens): Observable<StreamMessage> {
    const url = lens
      ? `${this.config.streamUrl}?${TENANT_LENS_QUERY_PARAMETER}=${encodeURIComponent(lens)}`
      : this.config.streamUrl;
    return defer(
      () =>
        webSocket<StreamMessage | StreamClientMessage>({
          url,
          openObserver: {
            next: () =>
              this.store.dispatch(
                SessionActions.streamStatusChanged({ status: "LIVE" }),
              ),
          },
          closeObserver: {
            next: () =>
              this.store.dispatch(
                SessionActions.streamStatusChanged({ status: "RECONNECTING" }),
              ),
          },
        }) as Observable<StreamMessage>,
    ).pipe(
      retry({
        delay: (_error, attempt) =>
          timer(EXPONENTIAL_RECONNECT.delayForAttempt(attempt)),
      }),
    );
  }
}
