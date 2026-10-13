import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Icon } from '../../shared/ui/icon/icon';
import { NAVIGATION_ITEMS, NAVIGATION_SECTIONS } from '../navigation/navigation-items';
import { ShellState } from '../shell/shell-state';

/** Every destination as a bottom sheet with large touch targets; opened by the menu button or "More". */
@Component({
  selector: 'sentinel-mobile-navigation-sheet',
  imports: [Icon, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="sheet sentinel-panel--elevated sentinel-scroll" role="dialog" aria-modal="true" aria-label="Navigation">
      <span class="handle" aria-hidden="true"></span>
      @for (group of groups; track group.section) {
        @if (group.label) {
          <p class="sentinel-eyebrow">{{ group.label }}</p>
        }
        <ul>
          @for (item of group.items; track item.id) {
            <li>
              @if (item.route) {
                <a [routerLink]="item.route" routerLinkActive="active" ariaCurrentWhenActive="page" (click)="shell.close()">
                  <sentinel-icon [name]="item.icon" /><span>{{ item.label }}</span>
                </a>
              } @else {
                <button type="button" (click)="shell.open('settings')"><sentinel-icon [name]="item.icon" /><span>{{ item.label }}</span></button>
              }
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    :host {
      position: fixed;
      left: 0;
      right: 0;
      bottom: calc(var(--sentinel-bottom-bar-height) + env(safe-area-inset-bottom, 0px));
      z-index: var(--sentinel-z-drawer);
    }
    .sheet {
      max-height: calc(100dvh - var(--sentinel-top-bar-height) - var(--sentinel-bottom-bar-height) - 16px);
      overflow-y: auto;
      padding: var(--sentinel-space-2) var(--sentinel-space-4) var(--sentinel-space-4);
      background: var(--sentinel-color-elevated);
      border-top: 1px solid var(--sentinel-color-border);
      border-radius: 18px 18px 0 0;
      box-shadow: var(--sentinel-elevation-overlay);
      animation: sheet-in var(--sentinel-motion-duration-slow) var(--sentinel-motion-easing-standard);
    }
    @keyframes sheet-in {
      from {
        transform: translateY(24px);
        opacity: 0;
      }
    }
    .handle {
      display: block;
      width: 40px;
      height: 4px;
      margin: 0 auto var(--sentinel-space-3);
      border-radius: 2px;
      background: var(--sentinel-color-border);
    }
    .sentinel-eyebrow {
      margin: var(--sentinel-space-4) 0 var(--sentinel-space-2);
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--sentinel-space-2);
    }
    a,
    button {
      display: flex;
      align-items: center;
      gap: var(--sentinel-space-3);
      width: 100%;
      min-height: 52px;
      padding: 0 var(--sentinel-space-3);
      border: 1px solid var(--sentinel-color-border-soft);
      border-radius: var(--sentinel-radius-medium);
      background: var(--sentinel-color-surface);
      color: var(--sentinel-color-text-secondary);
      font-size: var(--sentinel-font-size-caption);
      text-decoration: none;
      text-align: left;
    }
    a.active {
      color: var(--sentinel-color-text);
      border-color: color-mix(in srgb, var(--sentinel-color-accent) 45%, transparent);
      background: var(--sentinel-color-accent-soft);
    }
    a.active sentinel-icon {
      color: var(--sentinel-color-accent);
    }
  `,
})
export class MobileNavigationSheet {
  protected readonly shell = inject(ShellState);
  protected readonly groups = NAVIGATION_SECTIONS.map(({ section, label }) => ({
    section,
    label,
    items: NAVIGATION_ITEMS.filter((item) => item.section === section),
  }));
}
