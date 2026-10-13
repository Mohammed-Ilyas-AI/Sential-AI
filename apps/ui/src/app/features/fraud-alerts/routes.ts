import type { Routes } from '@angular/router';

export const FRAUD_ALERTS_ROUTES: Routes = [
  {
    path: '',
    title: 'Alerts & cases · SENTINEL AI',
    loadComponent: () => import('./pages/alerts-page/alerts-page').then((page) => page.AlertsPage),
  },
];
