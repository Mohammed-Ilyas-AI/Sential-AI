import { DOCUMENT, Injectable, inject, signal, type Signal } from '@angular/core';

export type TenantThemeId = 'sentinel' | 'bank-a' | 'bank-b' | 'bank-c';

export interface TenantThemeOption {
  readonly id: TenantThemeId;
  readonly label: string;
}

/** Synthetic tenants only; none of these is the branding of a real institution. */
export const TENANT_THEME_OPTIONS: readonly TenantThemeOption[] = [
  { id: 'sentinel', label: 'SENTINEL' },
  { id: 'bank-a', label: 'Bank A (synthetic)' },
  { id: 'bank-b', label: 'Bank B (synthetic)' },
  { id: 'bank-c', label: 'Bank C (synthetic)' },
];

/**
 * "View as Bank A / Bank B" over synthetic data. A UI projection only — designed as a multi-tenant platform,
 * demonstrated as a single deployment on synthetic data. Risk-band colours never change per tenant.
 */
@Injectable({ providedIn: 'root' })
export class TenantLens {
  private readonly document = inject(DOCUMENT);
  private readonly theme = signal<TenantThemeId>('sentinel');

  readonly activeTheme: Signal<TenantThemeId> = this.theme.asReadonly();

  switchTo(theme: TenantThemeId): void {
    this.theme.set(theme);
    const root = this.document.documentElement;
    if (theme === 'sentinel') root.removeAttribute('data-tenant-theme');
    else root.setAttribute('data-tenant-theme', theme);
  }
}
