import { inject, provideAppInitializer, type EnvironmentProviders, type Provider } from '@angular/core';
import { StreamIngest } from './stream-ingest/stream-ingest';
import { RealtimeConnection } from './websocket-client/realtime-connection';
import { WebSocketRealtimeConnection } from './websocket-client/websocket-realtime-connection';

/** Connects to sentinel-stream when the app starts and keeps state fed for the app's lifetime. */
export function provideRealtimeStream(): (Provider | EnvironmentProviders)[] {
  return [
    { provide: RealtimeConnection, useClass: WebSocketRealtimeConnection },
    provideAppInitializer(() => inject(StreamIngest).start()),
  ];
}
