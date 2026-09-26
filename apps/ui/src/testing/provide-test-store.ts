import type { EnvironmentProviders } from '@angular/core';
import { provideState, provideStore } from '@ngrx/store';
import { alertsFeature } from '../app/state/alerts/alerts.feature';
import { interventionsFeature } from '../app/state/interventions/interventions.feature';
import { sessionFeature } from '../app/state/session/session.feature';
import { transactionsFeature } from '../app/state/transactions/transactions.feature';

/** The real reducers, without the realtime stream: specs dispatch what the stream would have delivered. */
export function provideTestStore(): EnvironmentProviders[] {
  return [
    provideStore(),
    provideState(sessionFeature),
    provideState(alertsFeature),
    provideState(transactionsFeature),
    provideState(interventionsFeature),
  ];
}
