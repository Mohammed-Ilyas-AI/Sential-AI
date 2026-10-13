import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Icon } from '../../shared/ui/icon/icon';
import { MOBILE_BOTTOM_ITEMS } from '../navigation/navigation-items';
import { ShellState } from '../shell/shell-state';

/** Phone navigation: the four destinations an analyst reaches for on the move, and everything else under More. */
@Component({
  selector: 'sentinel-mobile-bottom-bar',
  imports: [Icon, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav aria-label="Primary">
      @for (item of items; track item.id) {
        <a class="tab" [routerLink]="item.route" routerLinkActive="active" ariaCurrentWhenActive="page" (click)="shell.close()">
          <sentinel-icon [name]="item.icon" [size]="22" />
          <span>{{ item.mobileLabel ?? item.label }}</span>
        </a>
      }
      <button type="button" class="tab" [class.active]="shell.mobileNavigationOpen()" [attr.aria-expanded]="shell.mobileNavigationOpen()" (click)="shell.toggle('mobile-navigation')">
        <sentinel-icon name="grid" [size]="22" />
        <span>More</span>
      </button>
    </nav>
  `,
  styles: `
    :host {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: var(--sentinel-z-bottom-bar);
      display: block;
      padding-bottom: env(safe-area-inset-bottom, 0px);
      background: color-mix(in srgb, var(--sentinel-color-surface) 90%, transparent);
      backdrop-filter: blur(16px) saturate(140%);
      border-top: 1px solid var(--sentinel-color-border-soft);
    }
    nav {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      height: var(--sentinel-bottom-bar-height);
      padding: 0 var(--sentinel-space-1);
    }
    .tab {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      min-width: 0;
      border: 0;
      background: none;
      color: var(--sentinel-color-text-muted);
      font-size: 0.6875rem;
      text-decoration: none;
      cursor: pointer;
      transition: color var(--sentinel-motion-duration-fast) var(--sentinel-motion-easing-standard);
    }
    .tab span {
      white-space: nowrap;
    }
    .tab.active {
      color: var(--sentinel-color-accent);
      font-weight: 600;
    }
    .tab.active::before {
      content: '';
      position: absolute;
      top: 0;
      left: 30%;
      right: 30%;
      height: 2px;
      border-radius: 0 0 2px 2px;
      background: var(--sentinel-color-accent);
      box-shadow: 0 0 10px var(--sentinel-color-accent);
    }
  `,
})
export class MobileBottomBar {
  protected readonly shell = inject(ShellState);
  protected readonly items = MOBILE_BOTTOM_ITEMS;
}
