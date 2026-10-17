import type { Routes } from '@angular/router';

export const ACCOUNTS_ROUTES: Routes = [
  {
    path: '',
    title: 'Accounts · SENTINEL AI',
    loadComponent: () => import('./pages/accounts-page/accounts-page').then((page) => page.AccountsPage),
  },
];
