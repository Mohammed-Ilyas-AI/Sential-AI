import type { Routes } from '@angular/router';

export const INTERVENTIONS_ROUTES: Routes = [
  {
    path: '',
    title: 'Interventions · SENTINEL AI',
    loadComponent: () => import('./pages/interventions-page/interventions-page').then((page) => page.InterventionsPage),
  },
];
