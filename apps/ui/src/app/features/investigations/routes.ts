import type { Routes } from '@angular/router';
import { provideState } from '@ngrx/store';
import { investigationsFeature } from './state/investigations.feature';

export const INVESTIGATIONS_ROUTES: Routes = [
  {
    path: '',
    title: 'Investigation · SENTINEL AI',
    providers: [provideState(investigationsFeature)],
    loadComponent: () =>
      import('./pages/investigation-page/investigation-page').then((page) => page.InvestigationPage),
  },
];
