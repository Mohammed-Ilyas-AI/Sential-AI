import type { Signal } from '@angular/core';

export type TenantThemeId = 'sentinel' | 'bank-a' | 'bank-b' | 'bank-c';

/**
 * Stretch: "view as Bank A / Bank B" over synthetic data with field-level masking. A UI projection only —
 * designed as a multi-tenant platform, demonstrated as a single deployment on synthetic data.
 */
export abstract class TenantLens {
  abstract readonly activeTheme: Signal<TenantThemeId>;
  abstract switchTo(theme: TenantThemeId): void;
}
