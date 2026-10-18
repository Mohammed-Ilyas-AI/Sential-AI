import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { type ApplicationConfig, ErrorHandler, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideState, provideStore } from '@ngrx/store';
import { routes } from './app.routes';
import { provideRuntimeConfig, type RuntimeConfig } from './core/config/runtime-config';
import { SentinelErrorHandler } from './core/error-handling/sentinel-error-handler';
import { traceIdInterceptor } from './core/http/interceptors/trace-id-interceptor';
import { tenantLensInterceptor } from './core/http/interceptors/tenant-lens-interceptor';
import { provideRealtimeStream } from './core/realtime/provide-realtime-stream';
import { ThemePreferences } from './core/theme/theme-preferences';
import { alertsFeature } from './state/alerts/alerts.feature';
import { interventionsFeature } from './state/interventions/interventions.feature';
import { sessionFeature } from './state/session/session.feature';
import { transactionsFeature } from './state/transactions/transactions.feature';

export function appConfigFor(runtimeConfig: RuntimeConfig): ApplicationConfig {
  return {
    providers: [
      provideBrowserGlobalErrorListeners(),
      provideRouter(routes, withComponentInputBinding()),
      provideHttpClient(withFetch(), withInterceptors([traceIdInterceptor, tenantLensInterceptor])),
      provideStore(),
      provideState(sessionFeature),
      provideState(alertsFeature),
      provideState(transactionsFeature),
      provideState(interventionsFeature),
      provideRuntimeConfig(runtimeConfig),
      provideRealtimeStream(),
      { provide: ErrorHandler, useClass: SentinelErrorHandler },
      // The remembered brand preset and appearance apply before the first route renders.
      provideAppInitializer(() => void inject(ThemePreferences)),
    ],
  };
}
