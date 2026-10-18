import { Injectable, signal, type Signal } from '@angular/core';
import { SYNTHETIC_INSTITUTIONS, type InstitutionId, type TenantLens } from '@sentinel/domain';

const LENS_PREFERENCE_KEY = 'sentinel.data-lens';

function readLens(): TenantLens {
  try {
    const stored = globalThis.localStorage?.getItem(LENS_PREFERENCE_KEY) ?? null;
    return stored !== null && SYNTHETIC_INSTITUTIONS.includes(stored) ? stored : null;
  } catch {
    return null;
  }
}

/**
 * The data lens (T§14): which participating institution's analyst is looking. sentinel-core and sentinel-stream
 * project every response through it on the server, so another bank's fields are masked or withheld before they
 * reach the browser. Null is the single synthetic deployment's operator view. This is a projection over
 * synthetic data, not tenant isolation: there is no per-tenant sign-in yet. Separate from the brand theme,
 * which stays presentation only.
 */
@Injectable({ providedIn: 'root' })
export class TenantLensPreference {
  private readonly lensState = signal<TenantLens>(readLens());
  readonly lens: Signal<TenantLens> = this.lensState.asReadonly();
  readonly options: readonly InstitutionId[] = SYNTHETIC_INSTITUTIONS;

  select(lens: TenantLens): void {
    try {
      if (lens) globalThis.localStorage?.setItem(LENS_PREFERENCE_KEY, lens);
      else globalThis.localStorage?.removeItem(LENS_PREFERENCE_KEY);
    } catch {
      // A remembered lens is a convenience; the server applies whichever lens each request carries.
    }
    this.lensState.set(lens);
  }
}
