import type { Routes } from '@angular/router';

export const INTEGRATIONS_ROUTES: Routes = [
  {
    path: '',
    title: 'Integrations · SENTINEL AI',
    loadComponent: () => import('./pages/integrations-page/integrations-page').then((page) => page.IntegrationsPage),
  },
];
