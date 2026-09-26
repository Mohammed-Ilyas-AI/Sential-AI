import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'sentinel-navigation',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav aria-label="Primary">
      <a routerLink="/control-tower" routerLinkActive="active">Control tower</a>
      <a routerLink="/investigations" routerLinkActive="active">Investigations</a>
      <a routerLink="/network-analysis" routerLinkActive="active">Network analysis</a>
      <a routerLink="/cases" routerLinkActive="active">Cases</a>
    </nav>
  `,
  styles: `
    nav {
      display: flex;
      gap: var(--sentinel-space-4);
      padding: var(--sentinel-space-2) var(--sentinel-space-4);
    }
    a {
      color: var(--sentinel-color-text-muted);
    }
    a.active {
      color: var(--sentinel-color-text);
    }
  `,
})
export class Navigation {}
