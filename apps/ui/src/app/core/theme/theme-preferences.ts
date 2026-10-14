import { DOCUMENT, Injectable, inject, signal, type Signal } from '@angular/core';

export type BrandPresetId = 'sentinel' | 'bank-a' | 'bank-b' | 'bank-c';
export type AppearanceMode = 'dark' | 'light';

export interface BrandPresetOption {
  readonly id: BrandPresetId;
  readonly label: string;
  readonly identity: string;
  readonly synthetic: boolean;
}

/** Synthetic tenants only; none of these is the name, logo or branding of a real institution. */
export const BRAND_PRESET_OPTIONS: readonly BrandPresetOption[] = [
  { id: 'sentinel', label: 'SENTINEL AI', identity: 'Platform', synthetic: false },
  { id: 'bank-a', label: 'Bank A', identity: 'Meridian Ruby', synthetic: true },
  { id: 'bank-b', label: 'Bank B', identity: 'Harbour Teal', synthetic: true },
  { id: 'bank-c', label: 'Bank C', identity: 'Straits Indigo', synthetic: true },
];

export const APPEARANCE_OPTIONS: readonly { readonly id: AppearanceMode; readonly label: string }[] = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
];

/** Read by the inline boot script in index.html too, so the first paint already has the right theme. */
export const BRAND_PREFERENCE_KEY = 'sentinel.theme.brand';
export const APPEARANCE_PREFERENCE_KEY = 'sentinel.theme.appearance';

/** The address-bar colour follows the canvas of the active mode. */
const THEME_COLOR: Readonly<Record<AppearanceMode, string>> = { dark: '#070b10', light: '#f4f7fb' };

function readPreference<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const stored = globalThis.localStorage?.getItem(key);
    return allowed.find((value) => value === stored) ?? fallback;
  } catch {
    return fallback;
  }
}

function writePreference(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the preference is a convenience only.
  }
}

/**
 * The two independent theme controls: a brand preset (SENTINEL AI or a synthetic bank lens) and an appearance
 * mode. Both are pure presentation — written as attributes on <html> that the design tokens key off, and
 * remembered in this browser. Nothing here reaches the store, the API or any rule, score, decision or hold.
 */
@Injectable({ providedIn: 'root' })
export class ThemePreferences {
  private readonly document = inject(DOCUMENT);
  private readonly brandState = signal<BrandPresetId>(
    readPreference(BRAND_PREFERENCE_KEY, BRAND_PRESET_OPTIONS.map((option) => option.id), 'sentinel'),
  );
  private readonly appearanceState = signal<AppearanceMode>(
    readPreference(APPEARANCE_PREFERENCE_KEY, APPEARANCE_OPTIONS.map((option) => option.id), 'dark'),
  );

  readonly brand: Signal<BrandPresetId> = this.brandState.asReadonly();
  readonly appearance: Signal<AppearanceMode> = this.appearanceState.asReadonly();

  constructor() {
    this.apply();
  }

  selectBrand(brand: BrandPresetId): void {
    writePreference(BRAND_PREFERENCE_KEY, brand);
    this.brandState.set(brand);
    this.apply();
  }

  selectAppearance(appearance: AppearanceMode): void {
    writePreference(APPEARANCE_PREFERENCE_KEY, appearance);
    this.appearanceState.set(appearance);
    this.apply();
  }

  private apply(): void {
    const root = this.document.documentElement;
    const brand = this.brandState();
    const appearance = this.appearanceState();
    if (brand === 'sentinel') root.removeAttribute('data-tenant-theme');
    else root.setAttribute('data-tenant-theme', brand);
    if (appearance === 'light') root.setAttribute('data-appearance', 'light');
    else root.removeAttribute('data-appearance');
    this.document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[appearance]);
  }
}
