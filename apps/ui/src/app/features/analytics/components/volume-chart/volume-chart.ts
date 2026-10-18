import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { RiskBand } from '@sentinel/domain';
import type { VolumeBucket } from '../../data-access/analytics-facade';

const BANDS: readonly RiskBand[] = ['LOW', 'ELEVATED', 'HIGH', 'CRITICAL'];
const WIDTH = 720;
const HEIGHT = 220;
const PAD = { left: 34, right: 8, top: 10, bottom: 24 };

/** Transfers over the tape's time span, stacked by risk band. Hover a bar for its counts. */
@Component({
  selector: 'sentinel-volume-chart',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header>
      <h2>Transaction volume trend</h2>
      <ul class="legend">
        @for (band of bands; track band) {
          <li [attr.data-band]="band">{{ band.charAt(0) + band.slice(1).toLowerCase() }}</li>
        }
      </ul>
    </header>
    @if (buckets().length > 0) {
      <svg [attr.viewBox]="'0 0 ' + width + ' ' + height" preserveAspectRatio="none" role="img" [attr.aria-label]="'Transfers per interval, ' + total() + ' in total'">
        @for (tick of ticks(); track tick.value) {
          <line class="grid" [attr.x1]="pad.left" [attr.x2]="width - pad.right" [attr.y1]="tick.y" [attr.y2]="tick.y" />
          <text class="axis" [attr.x]="pad.left - 6" [attr.y]="tick.y + 3" text-anchor="end">{{ tick.value }}</text>
        }
        @for (bar of bars(); track $index) {
          <g (mouseenter)="hover.set($index)" (mouseleave)="hover.set(null)">
            @for (segment of bar.segments; track segment.band) {
              <rect [attr.x]="bar.x" [attr.y]="segment.y" [attr.width]="bar.width" [attr.height]="segment.height" [attr.data-band]="segment.band" rx="2" />
            }
            <rect class="hit" [attr.x]="bar.x" [attr.y]="pad.top" [attr.width]="bar.width" [attr.height]="height - pad.top - pad.bottom" />
          </g>
        }
        @for (label of labels(); track label.x) {
          <text class="axis" [attr.x]="label.x" [attr.y]="height - 6" text-anchor="middle">{{ label.text | date: 'HH:mm' : 'UTC' }}</text>
        }
      </svg>
      @if (hover() !== null) {
        @let bucket = buckets()[hover()!];
        @if (bucket) {
          <p class="tip" role="status">
            {{ bucket.start | date: 'd MMM HH:mm:ss' : 'UTC' }} UTC · {{ bucket.total }} transfers · {{ bucket.counts.HIGH + bucket.counts.CRITICAL }} high risk
          </p>
        }
      }
    } @else {
      <p class="empty">No transfers in this scope yet.</p>
    }
  `,
  styleUrl: './volume-chart.css',
})
export class VolumeChart {
  readonly buckets = input<readonly VolumeBucket[]>([]);
  protected readonly bands = BANDS;
  protected readonly width = WIDTH;
  protected readonly height = HEIGHT;
  protected readonly pad = PAD;
  protected readonly hover = signal<number | null>(null);

  protected readonly total = computed(() => this.buckets().reduce((sum, bucket) => sum + bucket.total, 0));
  private readonly max = computed(() => Math.max(1, ...this.buckets().map((bucket) => bucket.total)));
  protected readonly ticks = computed(() => {
    const max = this.max();
    const step = Math.max(1, Math.ceil(max / 4));
    return Array.from({ length: Math.floor(max / step) + 1 }, (_, index) => {
      const value = index * step;
      return { value, y: HEIGHT - PAD.bottom - (value / max) * (HEIGHT - PAD.top - PAD.bottom) };
    });
  });
  protected readonly bars = computed(() => {
    const buckets = this.buckets();
    const slot = (WIDTH - PAD.left - PAD.right) / Math.max(1, buckets.length);
    const scale = (HEIGHT - PAD.top - PAD.bottom) / this.max();
    return buckets.map((bucket, index) => {
      let base = HEIGHT - PAD.bottom;
      const segments = BANDS.map((band) => {
        const height = bucket.counts[band] * scale;
        base -= height;
        return { band, y: base, height };
      });
      return { x: PAD.left + index * slot + slot * 0.18, width: slot * 0.64, segments };
    });
  });
  protected readonly labels = computed(() => {
    const buckets = this.buckets();
    const slot = (WIDTH - PAD.left - PAD.right) / Math.max(1, buckets.length);
    return buckets.flatMap((bucket, index) => (index % 6 === 0 ? [{ x: PAD.left + index * slot + slot / 2, text: bucket.start }] : []));
  });
}
