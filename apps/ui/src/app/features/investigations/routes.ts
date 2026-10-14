import type { Routes } from '@angular/router';
import { InvestigationsFacade } from './data-access/investigations-facade';

export const INVESTIGATIONS_ROUTES: Routes = [
  {
    path: '',
    title: 'Investigation · SENTINEL AI',
    providers: [InvestigationsFacade],
    loadComponent: () =>
      import('./pages/investigation-page/investigation-page').then((page) => page.InvestigationPage),
  },
];
