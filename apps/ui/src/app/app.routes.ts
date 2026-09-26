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
    ],
  },
  { path: '**', redirectTo: '' },
];
