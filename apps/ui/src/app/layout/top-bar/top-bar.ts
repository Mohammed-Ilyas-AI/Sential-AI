import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { Icon } from '../../shared/ui/icon/icon';
import { sessionFeature } from '../../state/session/session.feature';
import { SentinelLogo } from '../brand/sentinel-logo';
import { NotificationCenter } from '../notification-panel/notification-center';
import { ShellState } from '../shell/shell-state';
import { LiveClock } from './live-clock';

/** Toggle, brand, live state, clock, notifications, settings, analyst. No search here. */
@Component({
  selector: 'sentinel-top-bar',
  imports: [Icon, SentinelLogo, LiveClock],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header>
      <div class="brand">
        <button type="button" class="sentinel-icon-button toggle desktop-only" [attr.aria-expanded]="shell.sidebarExpanded()" (click)="shell.toggleSidebar()">
          <sentinel-icon name="menu" [size]="22" label="Toggle navigation" />
        </button>
        <button type="button" class="sentinel-icon-button toggle mobile-only" [attr.aria-expanded]="shell.mobileNavigationOpen()" (click)="shell.toggle('mobile-navigation')">
          <sentinel-icon name="menu" [size]="22" label="Open navigation" />
        </button>
        <span class="divider desktop-only" aria-hidden="true"></span>
        <sentinel-logo />
      </div>

      <div class="controls">
        <span class="mode" role="status" [attr.data-status]="streamStatus()">
          <span class="dot" aria-hidden="true"></span>
          <span class="mode-label">{{ streamStatus() === 'LIVE' ? 'Live Mode' : streamStatus() === 'RECONNECTING' ? 'Reconnecting' : 'Connecting' }}</span>
        </span>
        <span class="divider wide-only" aria-hidden="true"></span>
        <sentinel-live-clock class="wide-only" />
        <span class="divider desktop-only" aria-hidden="true"></span>
        <button type="button" class="sentinel-icon-button bell" [attr.aria-expanded]="shell.notificationPanelOpen()" (click)="shell.toggle('notifications')">
          <sentinel-icon name="bell" [size]="22" [label]="'Notifications, ' + notifications.unreadCount() + ' unread'" />
          @if (notifications.unreadCount() > 0) {
            @for (count of [notifications.unreadCount()]; track count) {
              <span class="badge sentinel-mono" aria-hidden="true">{{ count > 9 ? '9+' : count }}</span>
            }
          }
        </button>
        <button type="button" class="sentinel-icon-button gear" [attr.aria-expanded]="shell.settingsPanelOpen()" (click)="shell.toggle('settings')">
          <sentinel-icon name="settings" [size]="22" label="Settings" />
        </button>
        <span class="divider desktop-only" aria-hidden="true"></span>
        <button type="button" class="profile" [attr.aria-expanded]="shell.userMenuOpen()" aria-haspopup="menu" (click)="shell.toggle('user-menu')">
          <span class="avatar" aria-hidden="true">FA</span>
          <span class="who desktop-only"><span class="name">Fraud analyst</span><span class="role">Fraud Operations</span></span>
          <sentinel-icon class="desktop-only" name="chevronDown" [size]="18" />
          <span class="sentinel-visually-hidden">Analyst menu</span>
        </button>
      </div>
    </header>
  `,
  styleUrl: './top-bar.css',
})
export class TopBar {
  protected readonly shell = inject(ShellState);
  protected readonly notifications = inject(NotificationCenter);
  protected readonly streamStatus = inject(Store).selectSignal(sessionFeature.selectStreamStatus);
}
