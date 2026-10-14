import { Injectable, computed, inject, signal } from '@angular/core';
import { Store } from '@ngrx/store';
import {
  selectOperationalNotifications,
  type OperationalNotification,
} from '../../state/operational-notifications/operational-notifications.selectors';

/** Read state is per analyst session and purely visual, so it lives in a signal rather than the store. */
@Injectable({ providedIn: 'root' })
export class NotificationCenter {
  private readonly store = inject(Store);
  private readonly readIds = signal<ReadonlySet<string>>(new Set());

  readonly notifications = this.store.selectSignal(selectOperationalNotifications);
  readonly unreadCount = computed(() => this.notifications().filter((notification) => !this.readIds().has(notification.id)).length);

  isUnread(notification: OperationalNotification): boolean {
    return !this.readIds().has(notification.id);
  }

  markAllRead(): void {
    this.readIds.set(new Set(this.notifications().map((notification) => notification.id)));
  }

  /** Clicking a notification marks it read and nothing else: the analyst stays where they are. */
  markRead(notification: OperationalNotification): void {
    this.readIds.update((ids) => new Set([...ids, notification.id]));
  }
}
