import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemePreferences } from '../../../../core/theme/theme-preferences';
import { hexWithAlpha, readHexToken } from '../../../../shared/ui/canvas/css-color-token';
import { Icon } from '../../../../shared/ui/icon/icon';
import { isLand } from '../../geo/land-mask';
import type { ThreatLandscapeView } from '../../models/operations-overview';

const STEP_DEGREES = 2;
/** The map omits the polar caps, as operational maps do; 72°N to 56°S. */
const NORTH = 72;
const SOUTH = -56;

/** A flat dotted map with a pulse at each synthetic institution, coloured by the worst band routed to it. */
@Component({
  selector: 'sentinel-threat-landscape',
  imports: [Icon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header>
      <h2 id="threat-title">Threat Landscape</h2>
      <span class="live"><span class="dot" aria-hidden="true"></span>Live</span>
      <a class="more" routerLink="/network-analysis"><sentinel-icon name="chevronRight" [size]="16" label="Open network analysis" /></a>
    </header>
    <div class="map" aria-labelledby="threat-title" role="img" [attr.aria-label]="summary()">
      <canvas #canvas aria-hidden="true"></canvas>
      @for (hotspot of view().hotspots; track hotspot.id) {
        <span class="hotspot" [attr.data-level]="hotspot.level" [style.left.%]="xOf(hotspot.longitude)" [style.top.%]="yOf(hotspot.latitude)"></span>
      }
    </div>
    <ul class="legend">
      <li data-level="high">High Risk <b class="sentinel-mono">{{ view().high }}</b></li>
      <li data-level="elevated">Elevated Risk <b class="sentinel-mono">{{ view().elevated }}</b></li>
      <li data-level="normal">Normal <b class="sentinel-mono">{{ view().normal }}</b></li>
    </ul>
  `,
  styleUrl: './threat-landscape.css',
})
export class ThreatLandscape {
  readonly view = input.required<ThreatLandscapeView>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly theme = inject(ThemePreferences);
  private redraw: () => void = () => undefined;

  constructor() {
    const destroyRef = inject(DestroyRef);
    effect(() => {
      this.theme.brand();
      this.theme.appearance();
      this.redraw();
    });
    afterNextRender(() => {
      if (typeof ResizeObserver !== 'function' || typeof matchMedia !== 'function') return;
      const canvas = this.canvas().nativeElement;
      const context = canvas.getContext('2d');
      if (!context) return;
      let size = { width: 0, height: 0 };
      this.redraw = () => this.drawDots(context, size.width, size.height);
      const observer = new ResizeObserver(([entry]) => {
        if (!entry) return;
        const ratio = Math.min(2, devicePixelRatio || 1);
        size = { width: entry.contentRect.width, height: entry.contentRect.height };
        canvas.width = Math.round(size.width * ratio);
        canvas.height = Math.round(size.height * ratio);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        this.redraw();
      });
      observer.observe(canvas);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  protected xOf(longitude: number): number {
    return ((longitude + 180) / 360) * 100;
  }

  protected yOf(latitude: number): number {
    return ((NORTH - latitude) / (NORTH - SOUTH)) * 100;
  }

  protected summary(): string {
    const { high, elevated, normal } = this.view();
    return `Transactions by risk: ${high} high, ${elevated} elevated, ${normal} normal.`;
  }

  private drawDots(context: CanvasRenderingContext2D, width: number, height: number): void {
    context.clearRect(0, 0, width, height);
    const columns = 360 / STEP_DEGREES;
    const rows = (NORTH - SOUTH) / STEP_DEGREES;
    const cellWidth = width / columns;
    const cellHeight = height / rows;
    const size = Math.max(1, Math.min(cellWidth, cellHeight) * 0.5);
    context.fillStyle = hexWithAlpha(readHexToken(this.host.nativeElement, '--sentinel-map-land', '#78a0dc'), 0.42);
    for (let row = 0; row < rows; row += 1) {
      const latitude = NORTH - (row + 0.5) * STEP_DEGREES;
      for (let column = 0; column < columns; column += 1) {
        const longitude = -180 + (column + 0.5) * STEP_DEGREES;
        if (isLand(latitude, longitude)) context.fillRect(column * cellWidth, row * cellHeight, size, size);
      }
    }
  }
}
