import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Icon } from '../../shared/ui/icon/icon';
import { ShellState } from '../shell/shell-state';

/**
 * Profile actions only: the analyst identity shown on screen and focus mode. Settings sit on the top-bar gear
 * and in the rail. No authentication exists, so the menu offers no sign-out.
 */
@Component({
  selector: 'sentinel-user-menu',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="menu sentinel-panel sentinel-panel--elevated" role="menu" aria-label="Analyst menu">
      <div class="identity">
        <span class="avatar" aria-hidden="true">FA</span>
        <span>
          <span class="name">Fraud analyst</span>
          <span class="role">Fraud Operations</span>
        </span>
      </div>
      <button type="button" role="menuitem" (click)="focus()">
        <sentinel-icon name="focus" [size]="18" />{{ shell.focusMode() ? 'Leave focus mode' : 'Focus mode' }}
      </button>
    </div>
  `,
  styles: `
    :host {
      position: fixed;
      top: calc(var(--sentinel-top-bar-height) + 8px);
      right: var(--sentinel-space-4);
      z-index: var(--sentinel-z-notification);
      width: 280px;
      animation: sentinel-enter var(--sentinel-motion-duration-slow) var(--sentinel-motion-easing-standard);
    }
    .menu {
      padding: var(--sentinel-space-2);
    }
    .identity {
      display: flex;
      gap: var(--sentinel-space-3);
      align-items: center;
      padding: var(--sentinel-space-3);
      margin-bottom: var(--sentinel-space-1);
      border-bottom: 1px solid var(--sentinel-color-border-soft);
    }
    .avatar {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--sentinel-color-accent), var(--sentinel-color-accent-strong));
      color: var(--sentinel-color-background);
      font-weight: 700;
      font-size: 0.8125rem;
    }
    .name,
    .role {
      display: block;
    }
    .name {
      font-weight: 600;
    }
    .role {
      color: var(--sentinel-color-text-muted);
      font-size: 0.75rem;
    }
    button {
      width: 100%;
      display: flex;
      align-items: center;
      gap: var(--sentinel-space-3);
      min-height: 40px;
      padding: 0 var(--sentinel-space-3);
      border: 0;
      border-radius: var(--sentinel-radius-small);
      background: none;
      color: var(--sentinel-color-text-secondary);
      cursor: pointer;
    }
    button:hover {
      background: var(--sentinel-color-hover);
      color: var(--sentinel-color-text);
    }
  `,
})
export class UserMenu {
  protected readonly shell = inject(ShellState);

  protected focus(): void {
    this.shell.close();
    this.shell.toggleFocusMode();
  }
}
