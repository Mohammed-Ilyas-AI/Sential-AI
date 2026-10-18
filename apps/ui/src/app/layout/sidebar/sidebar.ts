import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Store } from '@ngrx/store';
import { Icon } from '../../shared/ui/icon/icon';
import { alertsFeature } from '../../state/alerts/alerts.feature';
import { SkylineArtwork } from '../brand/skyline-artwork';
import { NAVIGATION_ITEMS, NAVIGATION_SECTIONS, type NavigationItem } from '../navigation/navigation-items';
import { ShellState } from '../shell/shell-state';

/**
 * Desktop and tablet rail. The top-bar toggle is the only collapse control; collapsing animates the width and
 * fades labels, and collapsed items show a tooltip. The Singapore skyline artwork, with its slogan, anchors the footer.
 */
@Component({
  selector: 'sentinel-sidebar',
  imports: [Icon, RouterLink, RouterLinkActive, SkylineArtwork],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.collapsed]': '!shell.sidebarExpanded()' },
  template: `
    <nav aria-label="Primary" class="sentinel-scroll">
      @for (group of groups(); track group.section) {
        <div class="group" [class.labelled]="!!group.label">
          @if (group.label) {
            <p class="section-label"><span>{{ group.label }}</span></p>
          }
          <ul>
            @for (item of group.items; track item.id) {
              <li>
                @if (item.route) {
                  <a
                    class="item"
                    [routerLink]="item.route"
                    routerLinkActive="active"
                    ariaCurrentWhenActive="page"
                    [attr.aria-label]="shell.sidebarExpanded() ? null : item.label"
                  >
                    <span class="indicator" aria-hidden="true"></span>
                    <sentinel-icon [name]="item.icon" [size]="22" />
                    <span class="label">{{ item.label }}</span>
                    @if (badgeFor(item); as badge) {
                      <span class="badge sentinel-mono" [attr.aria-label]="badge + ' open alerts'">{{ badge }}</span>
                    }
                    <span class="tooltip sentinel-tooltip" aria-hidden="true">{{ item.label }}</span>
                  </a>
                } @else {
                  <button type="button" class="item" [attr.aria-label]="shell.sidebarExpanded() ? null : item.label" (click)="shell.open('settings')">
                    <span class="indicator" aria-hidden="true"></span>
                    <sentinel-icon [name]="item.icon" [size]="22" />
                    <span class="label">{{ item.label }}</span>
                    <span class="tooltip sentinel-tooltip" aria-hidden="true">{{ item.label }}</span>
                  </button>
                }
              </li>
            }
          </ul>
        </div>
      }
    </nav>
    <sentinel-skyline-artwork class="atmosphere" />
  `,
  styleUrl: './sidebar.css',
})
export class Sidebar {
  protected readonly shell = inject(ShellState);
  private readonly openAlerts = inject(Store).selectSignal(alertsFeature.selectOpenAlerts);

  protected readonly groups = computed(() =>
    NAVIGATION_SECTIONS.map(({ section, label }) => ({ section, label, items: NAVIGATION_ITEMS.filter((item) => item.section === section) })),
  );

  protected badgeFor(item: NavigationItem): number | null {
    if (item.id !== 'alerts') return null;
    const count = this.openAlerts().length;
    return count > 0 ? count : null;
  }
}
