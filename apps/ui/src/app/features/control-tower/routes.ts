import type { Routes } from '@angular/router';

export const CONTROL_TOWER_ROUTES: Routes = [
  {
    path: '',
    title: 'Control tower · SENTINEL AI',
    loadComponent: () => import('./pages/control-tower-page/control-tower-page').then((page) => page.ControlTowerPage),
  },
];
