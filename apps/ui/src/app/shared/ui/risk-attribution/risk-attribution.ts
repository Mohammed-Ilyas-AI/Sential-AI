import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Contribution } from '@sentinel/domain';

/**
 * "Why did you stop this transaction?" Renders contributions[] exactly as the engine wrote them: no
 * transformation, no inference, no recomputed score. Stacked, bar widths are points out of the 100-point scale;
 * as rows, they are relative to the largest contribution so the ranking reads at a glance, and the points are
 * always printed beside them.
 */
@Component({
  selector: 'sentinel-risk-attribution',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-layout]': 'layout()' },
  template: `
    <section aria-label="Risk attribution">
      @if (contributions().length === 0) {
        <p class="empty">No rule fired.</p>
      } @else {
        <ol>
          @for (contribution of contributions(); track contribution.code) {
            <li [attr.data-weight]="weightOf(contribution.points)">
              <div class="line">
                <span class="label">{{ contribution.label }}</span>
                <span class="points sentinel-figures">+{{ contribution.points }}</span>
              </div>
              <div class="bar" aria-hidden="true"><span [style.width.%]="widthOf(contribution.points)"></span></div>
              <div class="detail">{{ contribution.detail }}</div>
            </li>
          }
        </ol>
        <p class="total sentinel-figures">Advisory score {{ score() }} / 100</p>
      }
    </section>
  `,
  styles: `
    ol {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: var(--sentinel-space-3);
    }
    .line {
      display: flex;
      justify-content: space-between;
      gap: var(--sentinel-space-2);
    }
    .label {
      font-weight: 500;
    }
    .points {
      font-family: var(--sentinel-font-family-mono);
    }
    .bar {
      height: 4px;
      margin-top: var(--sentinel-space-1);
      border-radius: var(--sentinel-radius-small);
      background: var(--sentinel-color-border);
      overflow: hidden;
    }
    .bar span {
      display: block;
      height: 100%;
      background: var(--sentinel-color-series);
    }
    .detail,
    .empty,
    .total {
      color: var(--sentinel-color-text-muted);
      font-size: var(--sentinel-font-size-caption);
    }
    .total {
      margin: var(--sentinel-space-3) 0 0;
      text-align: right;
    }

    /* Rows: label and evidence, a weighted bar, the points; one line per rule. */
    :host([data-layout='rows']) ol {
      gap: 0;
    }
    :host([data-layout='rows']) li {
      display: grid;
      grid-template-columns: minmax(120px, 1.2fr) minmax(70px, 1fr) 40px;
      grid-template-areas:
        'label bar points'
        'detail bar points';
      align-items: center;
      column-gap: var(--sentinel-space-3);
      padding: 6px 0;
      border-bottom: 1px solid var(--sentinel-color-border-soft);
    }
    :host([data-layout='rows']) li:last-child {
      border-bottom: 0;
    }
    :host([data-layout='rows']) .line {
      display: contents;
    }
    :host([data-layout='rows']) .label {
      grid-area: label;
      font-size: var(--sentinel-font-size-caption);
      font-weight: 600;
    }
    :host([data-layout='rows']) .points {
      grid-area: points;
      justify-self: end;
      font-size: var(--sentinel-font-size-body);
      font-weight: 700;
      color: var(--weight);
    }
    :host([data-layout='rows']) .detail {
      grid-area: detail;
      font-size: var(--sentinel-font-size-micro);
      overflow-wrap: anywhere;
    }
    :host([data-layout='rows']) .bar {
      grid-area: bar;
      height: 8px;
      margin: 0;
      border-radius: var(--sentinel-radius-pill);
      background: var(--sentinel-color-track, var(--sentinel-color-border));
    }
    :host([data-layout='rows']) .bar span {
      border-radius: inherit;
      background: var(--weight);
    }
    :host([data-layout='rows']) li { --weight: var(--sentinel-color-info); }
    :host([data-layout='rows']) li[data-weight='major'] { --weight: var(--sentinel-color-risk-critical); }
    :host([data-layout='rows']) li[data-weight='strong'] { --weight: var(--sentinel-color-risk-high); }
    :host([data-layout='rows']) li[data-weight='moderate'] { --weight: var(--sentinel-color-risk-elevated); }
    /* Compact: one line per rule (name, bar, points); the evidence text stays on the investigation page. */
    :host([data-layout='compact']) ol {
      gap: 4px;
    }
    :host([data-layout='compact']) li {
      display: grid;
      grid-template-columns: minmax(110px, 1.3fr) minmax(60px, 1fr) 34px;
      align-items: center;
      column-gap: var(--sentinel-space-3);
    }
    :host([data-layout='compact']) .line {
      display: contents;
    }
    :host([data-layout='compact']) .label {
      grid-column: 1;
      grid-row: 1;
      font-size: var(--sentinel-font-size-caption);
    }
    :host([data-layout='compact']) .bar {
      grid-column: 2;
      grid-row: 1;
      height: 7px;
      margin: 0;
      border-radius: var(--sentinel-radius-pill);
    }
    :host([data-layout='compact']) .bar span {
      border-radius: inherit;
      background: var(--weight);
    }
    :host([data-layout='compact']) .points {
      grid-column: 3;
      grid-row: 1;
      justify-self: end;
      font-weight: 700;
      color: var(--weight);
    }
    :host([data-layout='compact']) .detail,
    :host([data-layout='compact']) .total {
      display: none;
    }
    :host([data-layout='compact']) li { --weight: var(--sentinel-color-info); }
    :host([data-layout='compact']) li[data-weight='major'] { --weight: var(--sentinel-color-risk-critical); }
    :host([data-layout='compact']) li[data-weight='strong'] { --weight: var(--sentinel-color-risk-high); }
    :host([data-layout='compact']) li[data-weight='moderate'] { --weight: var(--sentinel-color-risk-elevated); }
    /* A narrow card stacks each row: name and points, then the evidence, then the bar. */
    :host([data-layout='rows']) {
      display: block;
      container-type: inline-size;
    }
    @container (max-width: 440px) {
      li {
        grid-template-columns: minmax(0, 1fr) 40px !important;
        grid-template-areas:
          'label points'
          'detail detail'
          'bar bar' !important;
        row-gap: 3px;
      }
    }
  `,
})
export class RiskAttribution {
  readonly contributions = input.required<readonly Contribution[]>();
  readonly score = input.required<number>();
  readonly layout = input<'stacked' | 'rows' | 'compact'>('stacked');

  private readonly largest = computed(() => Math.max(1, ...this.contributions().map((contribution) => contribution.points)));

  protected widthOf(points: number): number {
    return this.layout() === 'stacked' ? points : (points / this.largest()) * 100;
  }

  /** The bar's tone follows the contribution's points, never the brand. */
  protected weightOf(points: number): 'major' | 'strong' | 'moderate' | 'minor' {
    return points >= 25 ? 'major' : points >= 15 ? 'strong' : points >= 10 ? 'moderate' : 'minor';
  }
}
