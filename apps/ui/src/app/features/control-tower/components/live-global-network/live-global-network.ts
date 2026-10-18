import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../../../shared/ui/icon/icon';
import type { GlobeAction, GlobeCallout, GlobeDetail, NetworkStats } from '../../models/operations-overview';
import { GlobeDetailPanel } from '../globe-detail/globe-detail';
import { OperationsGlobe } from '../operations-globe/operations-globe';
import type { GlobeScene, GlobeTarget } from '../operations-globe/globe-renderer';

const MIN_ZOOM = 0.8;
/** Far enough in to separate the account nodes around one bank. */
const MAX_ZOOM = 2.6;
const ZOOM_STEP = 0.1;
/** Degrees per rotate button press. */
const ROTATE_STEP = 15;

/** The hero surface: network figures and legend over the left of the live Singapore map, its bank selector and view controls. */
@Component({
  selector: 'sentinel-live-global-network',
  imports: [Icon, OperationsGlobe, RouterLink, GlobeDetailPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="intro">
      <h2 id="network-title"><span class="dot" aria-hidden="true"></span>Live <span class="emphasis">Singapore</span> Network</h2>
      <p class="subtitle">Real-time transaction flow across banks and institutions</p>
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
      [callouts]="showCallouts() ? callouts() : hiddenCallouts"
      [description]="description()"
      [zoom]="zoom()"
      [heading]="heading()"
      [autoRotate]="rotating()"
      [recenter]="recenterCount()"
      [selection]="selection()"
      [showParticles]="showParticles()"
      [showRoutes]="showRoutes()"
      [showEntityLabels]="showEntityLabels()"
      (selected)="selectTarget.emit($event)"
      (openAlert)="action.emit({ type: 'open-alert', accountId: $event })"
      (zoomBy)="zoomBy($event)"
      (rotateBy)="rotateBy($event)"
    />

    <div class="toolbar">
      <label class="bank-select control">
        <sentinel-icon name="bank" [size]="16" />
        <span class="sentinel-visually-hidden">Focus the tower on a bank</span>
        <select [value]="focusedBankId()" (change)="focusBank($any($event.target).value)">
          <option value="">Singapore (All Banks)</option>
          @for (bank of scene().markers; track bank.id) {
            <option [value]="bank.id">{{ bank.label ?? bank.id }}</option>
          }
        </select>
      </label>
      <button type="button" class="show-all control" [attr.aria-pressed]="!bankFocus()" (click)="resetGlobalView()">Show all banks</button>
    </div>
    @if (detail(); as item) {
      <sentinel-globe-detail class="detail" [detail]="item" (action)="onDetailAction($event)" (closed)="resetGlobalView()" />
    }
    <button type="button" class="reset-chip control" title="Reset global view" aria-label="Reset global view" (click)="resetGlobalView()">
      <sentinel-icon name="settings" [size]="14" />
      Reset view
    </button>

    <div class="controls">
      <div class="group">
        <button
          type="button"
          class="control"
          [attr.aria-pressed]="rotating()"
          [attr.title]="rotating() ? 'Pause animation' : 'Resume animation'"
          (click)="rotating.set(!rotating())"
        >
          <sentinel-icon [name]="rotating() ? 'pause' : 'play'" [size]="20" [label]="rotating() ? 'Pause animation' : 'Resume animation'" />
        </button>
        <button type="button" class="control" title="Reset map position" aria-label="Reset map position" (click)="resetGlobalView()">
          <sentinel-icon name="focus" [size]="20" />
        </button>
        <a class="control" routerLink="/analytics"><sentinel-icon name="trendUp" [size]="20" label="Open analytics" /></a>
      </div>
      <details class="layers">
        <summary class="control" title="Display options" aria-label="Display options">
          <sentinel-icon name="settings" [size]="20" />
        </summary>
        <div class="layer-menu" aria-label="Map display options">
          <label><input type="checkbox" [checked]="showParticles()" (change)="showParticles.set(!showParticles())" /> Background particles</label>
          <label><input type="checkbox" [checked]="showCallouts()" (change)="showCallouts.set(!showCallouts())" /> Transaction labels</label>
          <label><input type="checkbox" [checked]="showRoutes()" (change)="showRoutes.set(!showRoutes())" /> Route lines</label>
          <label><input type="checkbox" [checked]="showEntityLabels()" (change)="showEntityLabels.set(!showEntityLabels())" /> Entity labels</label>
        </div>
      </details>
      <div class="group">
        <button type="button" class="control" [disabled]="zoom() >= maxZoom" (click)="zoomBy(zoomStep)">
          <sentinel-icon name="plus" [size]="20" label="Zoom in" />
        </button>
        <button type="button" class="control" [disabled]="zoom() <= minZoom" (click)="zoomBy(-zoomStep)">
          <sentinel-icon name="minus" [size]="20" label="Zoom out" />
        </button>
        <button type="button" class="control" (click)="rotateBy(-rotateStep)">
          <sentinel-icon name="rotateLeft" [size]="20" label="Rotate map left" />
        </button>
        <button type="button" class="control" (click)="rotateBy(rotateStep)">
          <sentinel-icon name="rotateRight" [size]="20" label="Rotate map right" />
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
  /** The selected globe target and its detail, both owned by the Control Tower facade. */
  readonly selection = input<GlobeTarget | null>(null);
  readonly detail = input<GlobeDetail | null>(null);
  readonly bankFocus = input<string | null>(null);
  readonly selectTarget = output<GlobeTarget | null>();
  readonly action = output<GlobeAction>();

  protected readonly zoom = signal(1);
  /** Map heading in degrees, kept within (-180, 180]. */
  protected readonly heading = signal(0);
  protected readonly rotateStep = ROTATE_STEP;
  protected readonly rotating = signal(true);
  protected readonly recenterCount = signal(0);
  protected readonly minZoom = MIN_ZOOM;
  protected readonly maxZoom = MAX_ZOOM;
  protected readonly zoomStep = ZOOM_STEP;
  protected readonly hiddenCallouts: readonly GlobeCallout[] = [];

  /** The focused bank's id, matched from the facade's focus label; empty for all banks. */
  protected readonly focusedBankId = computed(() => {
    const label = this.bankFocus();
    return label ? (this.scene().markers.find((marker) => (marker.label ?? marker.id) === label || marker.id === label)?.id ?? '') : '';
  });

  /** The selector focuses the tower on one bank; "all banks" is the same complete reset as Show all banks. */
  protected focusBank(id: string): void {
    if (id) this.action.emit({ type: 'focus-bank', id });
    else this.resetGlobalView();
  }

  protected rotateBy(degrees: number): void {
    this.heading.update((heading) => {
      const next = (((heading + degrees + 180) % 360) + 360) % 360 - 180;
      return Math.round(next * 100) / 100;
    });
  }

  protected zoomBy(step: number): void {
    this.zoom.update((zoom) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round((zoom + step) * 100) / 100)));
  }

  /** "Show all banks" in the panel is the same complete reset as X and Reset global view; other actions pass through. */
  protected onDetailAction(action: GlobeAction): void {
    if (action.type === 'clear-bank') this.resetGlobalView();
    else this.action.emit(action);
  }

  protected resetGlobalView(): void {
    this.action.emit({ type: 'clear-bank' });
    this.recenterCount.set(this.recenterCount() + 1);
    this.zoom.set(1);
    this.heading.set(0);
    this.rotating.set(true);
  }

  protected readonly showParticles = signal(true);
  protected readonly showCallouts = signal(true);
  protected readonly showRoutes = signal(true);
  protected readonly showEntityLabels = signal(false);
}
