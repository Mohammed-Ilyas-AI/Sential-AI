import type { Routes } from '@angular/router';

export const CASES_ROUTES: Routes = [
  {
    path: '',
    title: 'Cases · SENTINEL AI',
    loadComponent: () => import('./pages/cases-page/cases-page').then((page) => page.CasesPage),
  },
];
