import type { Routes } from '@angular/router';

export const ANALYTICS_ROUTES: Routes = [
  {
    path: 'scenario',
    title: 'Scenario launcher · SENTINEL AI',
    loadComponent: () => import('../demo-controls').then((feature) => feature.ScenarioLauncher),
  },
  {
    path: 'performance',
    title: 'Performance · SENTINEL AI',
    loadComponent: () => import('../demo-controls').then((feature) => feature.PerformancePanel),
  },
  {
    path: '',
    title: 'Analytics & reports · SENTINEL AI',
    loadComponent: () => import('./pages/analytics-page/analytics-page').then((page) => page.AnalyticsPage),
  },
];
