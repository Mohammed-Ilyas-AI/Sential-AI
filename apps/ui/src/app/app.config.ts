import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { type ApplicationConfig, ErrorHandler, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideState, provideStore } from '@ngrx/store';
import { routes } from './app.routes';
import { provideRuntimeConfig, type RuntimeConfig } from './core/config/runtime-config';
import { SentinelErrorHandler } from './core/error-handling/sentinel-error-handler';
import { traceIdInterceptor } from './core/http/interceptors/trace-id-interceptor';
import { provideRealtimeStream } from './core/realtime/provide-realtime-stream';
import { alertsFeature } from './state/alerts/alerts.feature';
import { interventionsFeature } from './state/interventions/interventions.feature';
import { sessionFeature } from './state/session/session.feature';
import { transactionsFeature } from './state/transactions/transactions.feature';

export function appConfigFor(runtimeConfig: RuntimeConfig): ApplicationConfig {
  return {
    providers: [
      provideBrowserGlobalErrorListeners(),
      provideRouter(routes, withComponentInputBinding()),
      provideHttpClient(withFetch(), withInterceptors([traceIdInterceptor])),
      provideStore(),
      provideState(sessionFeature),
      provideState(alertsFeature),
      provideState(transactionsFeature),
      provideState(interventionsFeature),
      provideRuntimeConfig(runtimeConfig),
      provideRealtimeStream(),
      { provide: ErrorHandler, useClass: SentinelErrorHandler },
    ],
  };
}
