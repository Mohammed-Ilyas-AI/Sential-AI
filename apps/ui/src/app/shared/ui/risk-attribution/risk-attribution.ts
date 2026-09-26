import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { Contribution } from '@sentinel/domain';

/**
 * "Why did you stop this transaction?" Renders contributions[] exactly as the engine wrote them: no
 * transformation, no inference, no recomputed score. Bar widths are points out of the 100-point scale.
 */
@Component({
  selector: 'sentinel-risk-attribution',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-label="Risk attribution">
      @if (contributions().length === 0) {
        <p class="empty">No rule fired.</p>
      } @else {
        <ol>
          @for (contribution of contributions(); track contribution.code) {
            <li>
              <div class="line">
                <span class="label">{{ contribution.label }}</span>
                <span class="points sentinel-figures">+{{ contribution.points }}</span>
              </div>
              <div class="bar" aria-hidden="true"><span [style.width.%]="contribution.points"></span></div>
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
      background: var(--sentinel-color-accent);
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
  `,
})
export class RiskAttribution {
  readonly contributions = input.required<readonly Contribution[]>();
  readonly score = input.required<number>();
}
