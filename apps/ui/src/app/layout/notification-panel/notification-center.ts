import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { AlertsActions } from '../../state/alerts/alerts.actions';
import {
  selectOperationalNotifications,
  type OperationalNotification,
} from '../../state/operational-notifications/operational-notifications.selectors';
import { ShellState } from '../shell/shell-state';

/** Read state is per analyst session and purely visual, so it lives in a signal rather than the store. */
@Injectable({ providedIn: 'root' })
export class NotificationCenter {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly shell = inject(ShellState);
  private readonly readIds = signal<ReadonlySet<string>>(new Set());

  readonly notifications = this.store.selectSignal(selectOperationalNotifications);
  readonly unreadCount = computed(() => this.notifications().filter((notification) => !this.readIds().has(notification.id)).length);

  isUnread(notification: OperationalNotification): boolean {
    return !this.readIds().has(notification.id);
  }

  markAllRead(): void {
    this.readIds.set(new Set(this.notifications().map((notification) => notification.id)));
  }

  /** Marks it read, closes any overlay, focuses its account and opens the control tower on it. */
  open(notification: OperationalNotification): void {
    this.readIds.update((ids) => new Set([...ids, notification.id]));
    this.shell.close();
    this.store.dispatch(AlertsActions.accountSelected({ accountId: notification.accountId }));
    void this.router.navigate(['/control-tower']);
  }
}
