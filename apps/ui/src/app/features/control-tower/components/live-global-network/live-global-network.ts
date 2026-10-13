import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../../../shared/ui/icon/icon';
import type { NetworkStats, GlobeCallout } from '../../models/operations-overview';
import { OperationsGlobe } from '../operations-globe/operations-globe';
import type { GlobeScene } from '../operations-globe/globe-renderer';

const MIN_ZOOM = 0.8;
const MAX_ZOOM = 1.35;
const ZOOM_STEP = 0.1;

/** The hero surface: network figures and legend on the left, the live globe, and its view controls. */
@Component({
  selector: 'sentinel-live-global-network',
  imports: [Icon, OperationsGlobe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="intro">
      <h2 id="network-title">Live Global Network</h2>
      <p class="subtitle"><span class="dot" aria-hidden="true"></span>Real-time transaction flow across banks and institutions</p>
    </div>

    <ul class="stats" aria-label="Network figures">
      <li class="stat">
        <span class="icon" data-tone="blue"><sentinel-icon name="bank" [size]="22" /></span>
        <span class="figure"><span class="value sentinel-mono">{{ stats().banksConnected }}</span><span class="caption">Banks Connected</span></span>
      </li>
      <li class="stat">
        <span class="icon" data-tone="indigo"><sentinel-icon name="network" [size]="22" /></span>
        <span class="figure"><span class="value sentinel-mono">{{ stats().activeRoutes }}</span><span class="caption">Active Routes</span></span>
      </li>
      <li class="stat">
        <span class="icon" data-tone="red"><sentinel-icon name="account" [size]="22" /></span>
        <span class="figure"><span class="value sentinel-mono">{{ stats().accountsMonitored }}</span><span class="caption">Accounts Monitored</span></span>
      </li>
    </ul>

    <ul class="legend" aria-label="Route legend">
      <li data-tone="normal">Normal</li>
      <li data-tone="elevated">Elevated Risk</li>
      <li data-tone="high">High Risk</li>
      <li data-tone="held">Held / Blocked</li>
    </ul>

    <sentinel-operations-globe
      class="globe"
      [scene]="scene()"
      [callouts]="callouts()"
      [description]="description()"
      [zoom]="zoom()"
      [autoRotate]="rotating()"
      [recenter]="recenterCount()"
    />

    <div class="controls">
      <div class="group">
        <button type="button" class="control" [attr.aria-pressed]="rotating()" (click)="rotating.set(!rotating())">
          <sentinel-icon name="environment" [size]="20" [label]="rotating() ? 'Pause rotation' : 'Resume rotation'" />
        </button>
        <button type="button" class="control" (click)="recenterCount.set(recenterCount() + 1)">
          <sentinel-icon name="focus" [size]="20" label="Recentre view" />
        </button>
        <a class="control" routerLink="/analytics"><sentinel-icon name="trendUp" [size]="20" label="Open analytics" /></a>
      </div>
      <div class="group">
        <button type="button" class="control" [disabled]="zoom() >= maxZoom" (click)="zoomBy(zoomStep)">
          <sentinel-icon name="plus" [size]="20" label="Zoom in" />
        </button>
        <button type="button" class="control" [disabled]="zoom() <= minZoom" (click)="zoomBy(-zoomStep)">
          <sentinel-icon name="minus" [size]="20" label="Zoom out" />
        </button>
      </div>
    </div>
  `,
  styleUrl: './live-global-network.css',
})
export class LiveGlobalNetwork {
  readonly scene = input.required<GlobeScene>();
  readonly callouts = input<readonly GlobeCallout[]>([]);
  readonly stats = input.required<NetworkStats>();
  readonly description = input('');

  protected readonly zoom = signal(1);
  protected readonly rotating = signal(true);
  protected readonly recenterCount = signal(0);
  protected readonly minZoom = MIN_ZOOM;
  protected readonly maxZoom = MAX_ZOOM;
  protected readonly zoomStep = ZOOM_STEP;

  protected zoomBy(step: number): void {
    this.zoom.update((zoom) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round((zoom + step) * 100) / 100)));
  }
}
