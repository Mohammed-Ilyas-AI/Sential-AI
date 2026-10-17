import type { Routes } from '@angular/router';

export const AUDIT_LOGS_ROUTES: Routes = [
  { path: '', title: 'Audit logs · SENTINEL AI', loadComponent: () => import('./pages/audit-logs-page/audit-logs-page').then((page) => page.AuditLogsPage) },
];
