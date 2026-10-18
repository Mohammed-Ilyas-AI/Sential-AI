import type { Routes } from '@angular/router';

export const POLICIES_ROUTES: Routes = [
  {
    path: '',
    title: 'Policies & rules · SENTINEL AI',
    loadComponent: () => import('./pages/policies-page/policies-page').then((page) => page.PoliciesPage),
  },
];
