import type { Routes } from '@angular/router';

export const POLICY_ROUTES: Routes = [
  { path: '', title: 'Policy & rules · SENTINEL AI', loadComponent: () => import('./pages/policy-page/policy-page').then((page) => page.PolicyPage) },
];
