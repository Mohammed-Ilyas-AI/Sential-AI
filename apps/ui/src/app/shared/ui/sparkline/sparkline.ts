import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const WIDTH = 160;
const HEIGHT = 36;

let nextGradientId = 0;

/** A trend line with a soft fill: shape only, no axes. Colour comes from the host's `color`. */
@Component({
  selector: 'sentinel-sparkline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.viewBox]="'0 0 ' + width + ' ' + height" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient [attr.id]="gradientId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="currentColor" stop-opacity="0.35" />
          <stop offset="1" stop-color="currentColor" stop-opacity="0" />
        </linearGradient>
      </defs>
      @if (variant() === 'bars') {
        @for (bar of bars(); track $index) {
          <rect [attr.x]="bar.x" [attr.y]="bar.y" [attr.width]="bar.width" [attr.height]="bar.height" rx="1" fill="currentColor" [attr.opacity]="bar.opacity" />
        }
      } @else {
        <path [attr.d]="area()" [attr.fill]="'url(#' + gradientId + ')'" />
        <path [attr.d]="line()" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
      }
    </svg>
  `,
  styles: `
    :host {
      display: block;
      height: 36px;
    }
    svg {
      width: 100%;
      height: 100%;
      overflow: visible;
    }
  `,
})
export class Sparkline {
  readonly values = input.required<readonly number[]>();
  readonly variant = input<'line' | 'bars'>('line');

  protected readonly width = WIDTH;
  protected readonly height = HEIGHT;
  protected readonly gradientId = `sentinel-sparkline-${(nextGradientId += 1)}`;

  private readonly points = computed(() => {
    const values = this.values();
    const max = Math.max(1, ...values);
    const step = values.length > 1 ? WIDTH / (values.length - 1) : WIDTH;
    return values.map((value, index) => ({ x: index * step, y: HEIGHT - 2 - (value / max) * (HEIGHT - 6) }));
  });

  protected readonly line = computed(() => this.points().map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' '));
  protected readonly area = computed(() => `${this.line()} L${WIDTH} ${HEIGHT} L0 ${HEIGHT} Z`);
  protected readonly bars = computed(() => {
    const values = this.values();
    const max = Math.max(1, ...values);
    const slot = WIDTH / Math.max(1, values.length);
    return values.map((value, index) => {
      const height = Math.max(2, (value / max) * (HEIGHT - 4));
      return { x: index * slot + slot * 0.2, y: HEIGHT - height, width: slot * 0.6, height, opacity: value === 0 ? 0.25 : 0.55 + (index / values.length) * 0.45 };
    });
  });
}
