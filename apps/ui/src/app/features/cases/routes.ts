import type { Routes } from '@angular/router';
import { provideState } from '@ngrx/store';
import { casesFeature } from './state/cases.feature';

export const CASES_ROUTES: Routes = [
  {
    path: '',
    title: 'Cases · SENTINEL AI',
    providers: [provideState(casesFeature)],
    loadComponent: () => import('./pages/cases-page/cases-page').then((page) => page.CasesPage),
  },
];
