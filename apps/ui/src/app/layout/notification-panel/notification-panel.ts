import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NotificationCenter } from './notification-center';
import { NotificationList } from './notification-list';

/** Anchored under the bell on desktop, a sheet on mobile. Operational events only, never chat. */
@Component({
  selector: 'sentinel-notification-panel',
  imports: [NotificationList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="sentinel-panel sentinel-panel--elevated" role="dialog" aria-modal="false" aria-labelledby="notifications-title">
      <header>
        <h2 id="notifications-title">Notifications</h2>
        <button type="button" class="sentinel-link-button" [disabled]="center.unreadCount() === 0" (click)="center.markAllRead()">
          Mark all read
        </button>
      </header>
      <div class="list sentinel-scroll">
        <sentinel-notification-list />
      </div>
    </section>
  `,
  styles: `
    :host {
      position: fixed;
      top: calc(var(--sentinel-top-bar-height) + 8px);
      right: var(--sentinel-space-4);
      z-index: var(--sentinel-z-notification);
      width: min(400px, calc(100vw - 2 * var(--sentinel-space-4)));
      animation: sentinel-enter var(--sentinel-motion-duration-slow) var(--sentinel-motion-easing-standard);
    }
    section {
      padding: var(--sentinel-space-4) var(--sentinel-space-3) var(--sentinel-space-2);
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 var(--sentinel-space-2) var(--sentinel-space-2);
    }
    h2 {
      margin: 0;
      font-size: 0.9375rem;
      font-weight: 600;
    }
    button:disabled {
      opacity: 0.4;
      cursor: default;
    }
    .list {
      max-height: min(60vh, 480px);
      overflow-y: auto;
    }
  `,
})
export class NotificationPanel {
  protected readonly center = inject(NotificationCenter);
}
