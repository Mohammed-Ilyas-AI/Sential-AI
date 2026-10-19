import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { LiveDemoNarrator, PerformancePanel } from '../../features/demo-controls';
import { CommandPalette } from '../command-palette/command-palette';
import { MobileBottomBar } from '../mobile-navigation/mobile-bottom-bar';
import { MobileNavigationSheet } from '../mobile-navigation/mobile-navigation-sheet';
import { NotificationPanel } from '../notification-panel/notification-panel';
import { SettingsPanel } from '../settings-panel/settings-panel';
import { Sidebar } from '../sidebar/sidebar';
import { TopBar } from '../top-bar/top-bar';
import { UserMenu } from '../user-menu/user-menu';
import { ShellState } from './shell-state';

/** One operator surface: top bar, rail, content frame and the overlays. Owns the global shortcuts. */
@Component({
  selector: 'sentinel-shell',
  imports: [RouterOutlet, TopBar, Sidebar, MobileBottomBar, MobileNavigationSheet, NotificationPanel, SettingsPanel, UserMenu, CommandPalette, PerformancePanel, LiveDemoNarrator],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.rail-collapsed]': '!state.sidebarExpanded()',
    '[class.focus-mode]': 'state.focusMode()',
    '(document:keydown)': 'onKeydown($event)',
  },
  template: `
    <a class="skip-link" href="#sentinel-main">Skip to content</a>
    <sentinel-top-bar />
    <sentinel-sidebar class="rail" />
    <main id="sentinel-main" tabindex="-1">
      <router-outlet />
    </main>
    <sentinel-mobile-bottom-bar class="bottom-bar" />

    @if (state.anyOverlayOpen()) {
      <button type="button" class="scrim" [class.dimmed]="modalOpen()" tabindex="-1" aria-label="Close panel" (click)="state.close()"></button>
    }
    @if (state.notificationPanelOpen()) {
      <sentinel-notification-panel />
    }
    @if (state.userMenuOpen()) {
      <sentinel-user-menu />
    }
    @if (state.settingsPanelOpen()) {
      <sentinel-settings-panel />
    }
    @if (state.mobileNavigationOpen()) {
      <sentinel-mobile-navigation-sheet />
    }
    @if (state.commandPaletteOpen()) {
      <sentinel-command-palette />
    }
    @if (performancePanelOpen()) {
      <sentinel-performance-panel (closed)="performancePanelOpen.set(false)" />
    }
    <sentinel-live-demo-narrator />
  `,
  styleUrl: './shell.css',
})
export class Shell {
  protected readonly state = inject(ShellState);
  /** The performance panel (T§5) sits behind a key combination; it measures only while open. */
  protected readonly performancePanelOpen = signal(false);
  private readonly router = inject(Router);
  protected readonly modalOpen = computed(
    () => this.state.commandPaletteOpen() || this.state.settingsPanelOpen() || this.state.mobileNavigationOpen(),
  );

  protected onKeydown(event: KeyboardEvent): void {
    const modifier = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (modifier && key === 'k') {
      // The Control Tower is for observation: it offers no search surface, not even the palette.
      if (this.router.url.startsWith('/control-tower')) return;
      event.preventDefault();
      this.state.toggle('command-palette');
    } else if (modifier && key === 'b') {
      event.preventDefault();
      this.state.toggleSidebar();
    } else if (modifier && event.shiftKey && key === 'p') {
      event.preventDefault();
      this.performancePanelOpen.update((open) => !open);
    } else if (modifier && key === '.') {
      event.preventDefault();
      this.state.toggleFocusMode();
    } else if (key === 'escape' && this.state.anyOverlayOpen()) {
      this.state.close();
    }
  }
}
