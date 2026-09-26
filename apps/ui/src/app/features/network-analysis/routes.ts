import type { Routes } from '@angular/router';

export const NETWORK_ANALYSIS_ROUTES: Routes = [
  {
    path: '',
    title: 'Network analysis · SENTINEL AI',
    loadComponent: () =>
      import('./pages/network-analysis-page/network-analysis-page').then((page) => page.NetworkAnalysisPage),
  },
];
