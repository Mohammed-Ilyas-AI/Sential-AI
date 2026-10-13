import { Injectable, computed, signal } from '@angular/core';

const SIDEBAR_PREFERENCE_KEY = 'sentinel.shell.sidebarExpanded';
/** Below this width the rail starts collapsed (tablet); below the mobile breakpoint it is replaced entirely. */
const TABLET_MAX_WIDTH = 1279;

export type ShellOverlay = 'command-palette' | 'notifications' | 'settings' | 'user-menu' | 'mobile-navigation';

function readSidebarPreference(): boolean | null {
  try {
    const stored = globalThis.localStorage?.getItem(SIDEBAR_PREFERENCE_KEY);
    return stored === null || stored === undefined ? null : stored === 'true';
  } catch {
    return null;
  }
}

function writeSidebarPreference(expanded: boolean): void {
  try {
    globalThis.localStorage?.setItem(SIDEBAR_PREFERENCE_KEY, String(expanded));
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the preference is a convenience only.
  }
}

function defaultSidebarExpanded(): boolean {
  const width = typeof globalThis.innerWidth === 'number' ? globalThis.innerWidth : Number.POSITIVE_INFINITY;
  return width > TABLET_MAX_WIDTH;
}

/**
 * Purely visual shell state. Signals, not NgRx: nothing here is domain state, and nothing outside the shell
 * reads it. Only one overlay is open at a time.
 */
@Injectable({ providedIn: 'root' })
export class ShellState {
  private readonly overlay = signal<ShellOverlay | null>(null);

  readonly sidebarExpanded = signal(readSidebarPreference() ?? defaultSidebarExpanded());
  readonly focusMode = signal(false);

  readonly commandPaletteOpen = computed(() => this.overlay() === 'command-palette');
  readonly notificationPanelOpen = computed(() => this.overlay() === 'notifications');
  readonly settingsPanelOpen = computed(() => this.overlay() === 'settings');
  readonly userMenuOpen = computed(() => this.overlay() === 'user-menu');
  readonly mobileNavigationOpen = computed(() => this.overlay() === 'mobile-navigation');
  readonly anyOverlayOpen = computed(() => this.overlay() !== null);

  toggleSidebar(): void {
    this.sidebarExpanded.update((expanded) => !expanded);
    writeSidebarPreference(this.sidebarExpanded());
  }

  toggleFocusMode(): void {
    this.focusMode.update((focused) => !focused);
  }

  toggle(overlay: ShellOverlay): void {
    this.overlay.update((open) => (open === overlay ? null : overlay));
  }

  open(overlay: ShellOverlay): void {
    this.overlay.set(overlay);
  }

  close(): void {
    this.overlay.set(null);
  }
}
