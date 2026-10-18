import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { RiskBand } from '@sentinel/domain';

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Share of transfers per risk band, as a donut with the total in the middle. */
@Component({
  selector: 'sentinel-risk-donut',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2>Risk distribution</h2>
    <div class="body">
      <svg viewBox="0 0 140 140" role="img" [attr.aria-label]="'Risk distribution of ' + total() + ' transfers'">
        <circle class="track" cx="70" cy="70" [attr.r]="radius" />
        @for (arc of arcs(); track arc.band) {
          <circle class="arc" cx="70" cy="70" [attr.r]="radius" [attr.data-band]="arc.band" [attr.stroke-dasharray]="arc.length + ' ' + circumference" [attr.stroke-dashoffset]="-arc.offset" />
        }
        <text x="70" y="68" text-anchor="middle" class="total">{{ total() }}</text>
        <text x="70" y="86" text-anchor="middle" class="caption">transfers</text>
      </svg>
      <ul>
        @for (slice of slices(); track slice.band) {
          <li [attr.data-band]="slice.band">
            <span class="name">{{ slice.band.charAt(0) + slice.band.slice(1).toLowerCase() }}</span>
            <b class="mono">{{ slice.share | number: '1.1-1' }}%</b>
            <span class="count mono">{{ slice.count }}</span>
          </li>
        }
      </ul>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
      padding: 14px 16px;
    }
    h2 {
      margin: 0 0 8px;
      font-size: 0.9375rem;
    }
    .body {
      display: grid;
      grid-template-columns: minmax(110px, 150px) minmax(0, 1fr);
      flex: 1;
      align-items: center;
      gap: 14px;
      min-height: 0;
    }
    svg {
      width: 100%;
      max-height: 100%;
      transform: rotate(-90deg);
    }
    text {
      transform: rotate(90deg);
      transform-origin: 70px 70px;
    }
    .track,
    .arc {
      fill: none;
      stroke-width: 16;
    }
    .track {
      stroke: var(--sentinel-color-border-soft);
    }
    .total {
      fill: var(--sentinel-color-text);
      font-size: 22px;
      font-weight: 800;
    }
    .caption {
      fill: var(--sentinel-color-text-secondary);
      font-size: 10px;
    }
    [data-band='LOW'] { --c: #3b82f6; stroke: #3b82f6; }
    [data-band='ELEVATED'] { --c: #f59e0b; stroke: #f59e0b; }
    [data-band='HIGH'] { --c: #f0566e; stroke: #f0566e; }
    [data-band='CRITICAL'] { --c: #c81e3a; stroke: #c81e3a; }
    ul {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: 0.8125rem;
    }
    li {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto 40px;
      align-items: center;
      gap: 8px;
    }
    .name::before {
      content: '';
      display: inline-block;
      width: 10px;
      height: 10px;
      margin-right: 7px;
      border-radius: 50%;
      background: var(--c);
    }
    .count {
      color: var(--sentinel-color-text-secondary);
      text-align: right;
    }
    .mono {
      font-family: var(--sentinel-font-family-mono);
    }
  `,
})
export class RiskDonut {
  readonly distribution = input<readonly { readonly band: RiskBand; readonly count: number }[]>([]);
  protected readonly radius = RADIUS;
  protected readonly circumference = CIRCUMFERENCE;
  protected readonly total = computed(() => this.distribution().reduce((sum, slice) => sum + slice.count, 0));
  protected readonly slices = computed(() => {
    const total = this.total() || 1;
    return this.distribution().map((slice) => ({ ...slice, share: (slice.count / total) * 100 }));
  });
  protected readonly arcs = computed(() => {
    const total = this.total();
    if (total === 0) return [];
    let offset = 0;
    return this.distribution().map((slice) => {
      const length = (slice.count / total) * CIRCUMFERENCE;
      const arc = { band: slice.band, length, offset };
      offset += length;
      return arc;
    });
  });
}
