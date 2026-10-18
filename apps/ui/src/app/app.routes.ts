import type { Routes } from '@angular/router';
import { Shell } from './layout/shell/shell';

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
      {
        path: 'accounts',
        loadChildren: () => import('./features/accounts').then((feature) => feature.ACCOUNTS_ROUTES),
      },
      {
        path: 'interventions',
        loadChildren: () => import('./features/interventions').then((feature) => feature.INTERVENTIONS_ROUTES),
      },
      {
        path: 'policy',
        loadChildren: () => import('./features/policies').then((feature) => feature.POLICIES_ROUTES),
      },
      {
        path: 'analytics',
        loadChildren: () => import('./features/analytics').then((feature) => feature.ANALYTICS_ROUTES),
      },
      {
        path: 'integrations',
        loadChildren: () => import('./features/integrations').then((feature) => feature.INTEGRATIONS_ROUTES),
      },
      {
        path: 'audit-logs',
        loadChildren: () => import('./features/audit-logs').then((feature) => feature.AUDIT_LOGS_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
