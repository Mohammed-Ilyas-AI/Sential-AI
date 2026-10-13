import type { Routes } from '@angular/router';

export const LIVE_TRANSACTIONS_ROUTES: Routes = [
  {
    path: '',
    title: 'Live transactions · SENTINEL AI',
    loadComponent: () =>
      import('./pages/live-transactions-page/live-transactions-page').then((page) => page.LiveTransactionsPage),
  },
];
