import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Icon } from '../../shared/ui/icon/icon';
import type { IconName } from '../../shared/ui/icon/icon-paths';
import type { NotificationSeverity } from '../../state/operational-notifications/operational-notifications.selectors';
import { NotificationCenter } from './notification-center';

const SEVERITY_ICON: Readonly<Record<NotificationSeverity, IconName>> = {
  critical: 'shieldAlert',
  warning: 'alert',
  info: 'network',
  success: 'shieldCheck',
};

/** Compact, severity-first list. Used by the top-bar panel and the control tower's notification card. */
@Component({
  selector: 'sentinel-notification-list',
  imports: [DatePipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (items().length === 0) {
      <p class="empty">No operational events yet. Holds, risk alerts and flagged relationships appear here.</p>
    } @else {
      <ul>
        @for (notification of items(); track notification.id) {
          <li>
            <button type="button" (click)="center.markRead(notification)" [attr.data-severity]="notification.severity" [attr.aria-label]="notification.title + ', ' + notification.description + (center.isUnread(notification) ? ', unread, mark as read' : '')">
              <span class="tile"><sentinel-icon [name]="icon[notification.severity]" [size]="18" /></span>
              <span class="body">
                <span class="title">{{ notification.title }}</span>
                <span class="description">{{ notification.description }}</span>
              </span>
              <span class="meta">
                <time class="sentinel-mono" [attr.datetime]="notification.at">{{ notification.at | date: 'HH:mm:ss' : 'UTC' }}</time>
                @if (center.isUnread(notification)) {
                  <span class="unread"><span class="sentinel-visually-hidden">Unread</span></span>
                }
              </span>
            </button>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    li + li {
      border-top: 1px solid var(--sentinel-color-border-soft);
    }
    button {
      width: 100%;
      display: grid;
      grid-template-columns: 36px minmax(0, 1fr) auto;
      gap: var(--sentinel-space-3);
      align-items: center;
      padding: var(--sentinel-space-3) var(--sentinel-space-2);
      border: 0;
      border-radius: var(--sentinel-radius-medium);
      background: none;
      color: inherit;
      text-align: left;
      cursor: pointer;
      transition: background var(--sentinel-motion-duration-fast) var(--sentinel-motion-easing-standard);
    }
    button:hover {
      background: var(--sentinel-color-hover);
    }
    .tile {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      border-radius: var(--sentinel-radius-medium);
      color: var(--tone);
      background: color-mix(in srgb, var(--tone) 12%, transparent);
      border: 1px solid color-mix(in srgb, var(--tone) 28%, transparent);
    }
    [data-severity='critical'] { --tone: var(--sentinel-color-critical); }
    [data-severity='warning'] { --tone: var(--sentinel-color-warning); }
    [data-severity='info'] { --tone: var(--sentinel-color-info); }
    [data-severity='success'] { --tone: var(--sentinel-color-success); }
    .body {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .title {
      font-weight: 600;
      font-size: var(--sentinel-font-size-caption);
    }
    .description {
      color: var(--sentinel-color-text-secondary);
      font-size: 0.75rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .meta {
      display: flex;
      align-items: center;
      gap: var(--sentinel-space-2);
      color: var(--sentinel-color-text-muted);
      font-size: 0.6875rem;
    }
    .unread {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--tone);
      box-shadow: 0 0 8px var(--tone);
    }
    .empty {
      margin: 0;
      padding: var(--sentinel-space-4) var(--sentinel-space-2);
      color: var(--sentinel-color-text-muted);
      font-size: var(--sentinel-font-size-caption);
    }
  `,
})
export class NotificationList {
  protected readonly center = inject(NotificationCenter);
  protected readonly icon = SEVERITY_ICON;
  readonly limit = input(20);

  protected readonly items = computed(() => this.center.notifications().slice(0, this.limit()));
}
