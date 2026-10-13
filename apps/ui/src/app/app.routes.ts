import type { Routes } from '@angular/router';
import { Shell } from './layout/shell/shell';
import type { ModuleId } from './layout/module-overview/module-catalogue';

const moduleOverview = (path: ModuleId, title: string) => ({
  path,
  title: `${title} · SENTINEL AI`,
  data: { moduleId: path },
  loadComponent: () => import('./layout/module-overview/module-overview-page').then((page) => page.ModuleOverviewPage),
});

/** Every feature is lazy-loaded through its public index.ts. */
export const routes: Routes = [
  {
    path: '',
    component: Shell,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'control-tower' },
      {
        path: 'control-tower',
        loadChildren: () => import('./features/control-tower').then((feature) => feature.CONTROL_TOWER_ROUTES),
      },
      {
        path: 'live-transactions',
        loadChildren: () => import('./features/live-transactions').then((feature) => feature.LIVE_TRANSACTIONS_ROUTES),
      },
      {
        path: 'alerts',
        loadChildren: () => import('./features/fraud-alerts').then((feature) => feature.FRAUD_ALERTS_ROUTES),
      },
      {
        path: 'investigations',
        loadChildren: () => import('./features/investigations').then((feature) => feature.INVESTIGATIONS_ROUTES),
      },
      {
        path: 'network-analysis',
        loadChildren: () =>
          import('./features/network-analysis').then((feature) => feature.NETWORK_ANALYSIS_ROUTES),
      },
      {
        path: 'cases',
        loadChildren: () => import('./features/cases').then((feature) => feature.CASES_ROUTES),
      },
      moduleOverview('accounts', 'Accounts'),
      moduleOverview('interventions', 'Interventions'),
      moduleOverview('policy', 'Policy & rules'),
      moduleOverview('analytics', 'Analytics & reports'),
      moduleOverview('integrations', 'Integrations'),
      moduleOverview('audit-logs', 'Audit logs'),
    ],
  },
  { path: '**', redirectTo: '' },
];
