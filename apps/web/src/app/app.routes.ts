import type { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'flow' },
  {
    path: 'flow',
    loadComponent: () => import('./features/live-flow/live-flow').then((m) => m.LiveFlow),
  },
  {
    path: 'cases/:id',
    loadComponent: () => import('./features/case-view/case-view').then((m) => m.CaseView),
  },
  {
    path: 'cases/:id/graph',
    loadComponent: () => import('./features/entity-graph/entity-graph').then((m) => m.EntityGraphView),
  },
  { path: '**', redirectTo: 'flow' },
];
