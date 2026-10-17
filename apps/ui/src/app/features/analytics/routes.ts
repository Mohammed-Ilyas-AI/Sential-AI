import type { Routes } from '@angular/router';

export const ANALYTICS_ROUTES: Routes = [
  { path: '', title: 'Analytics & reports · SENTINEL AI', loadComponent: () => import('./pages/analytics-page/analytics-page').then((page) => page.AnalyticsPage) },
];
