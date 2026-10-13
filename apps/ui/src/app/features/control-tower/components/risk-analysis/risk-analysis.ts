import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { RiskRuleCode } from '@sentinel/domain';
import { Icon } from '../../../../shared/ui/icon/icon';
import type { RiskAnalysisView } from '../../models/operations-overview';

/** Short names for a compact summary; the full engine labels stay in the tooltip and the decision trace. */
const SHORT_LABELS: Readonly<Record<RiskRuleCode, string>> = {
  RAPID_DRAIN: 'Rapid Drain',
  NEW_DEVICE: 'New Device',
  NEW_PAYEE: 'New Payee',
  VELOCITY: 'Velocity',
  ENTITY_LINK: 'Network Link',
  BEHAVIOUR_DEV: 'Behaviour',
  COOLING_OFF: 'Cooling-off',
};

const RING_RADIUS = 52;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/** The advisory score of the account in focus and its largest contributions: the score explains, the gate decides. */
@Component({
  selector: 'sentinel-risk-analysis',
  imports: [Icon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header>
      <h2>Risk Analysis</h2>
      <span class="live"><span class="dot" aria-hidden="true"></span>Live</span>
    </header>
    @if (view(); as view) {
      <div class="body" [attr.data-band]="view.band">
        <div class="gauge" role="img" [attr.aria-label]="'Advisory risk score ' + view.score + ' of 100, ' + view.band">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle class="track" cx="60" cy="60" [attr.r]="radius" />
            <circle class="value" cx="60" cy="60" [attr.r]="radius" [attr.stroke-dasharray]="dash()" />
          </svg>
          <span class="score sentinel-mono">{{ view.score }}</span>
          <span class="caption">Risk score</span>
        </div>
        <ul>
          @for (contribution of view.contributions; track contribution.code) {
            <li>
              <span class="bullet" aria-hidden="true"></span>
              <span class="name" [title]="contribution.label">{{ shortLabel[contribution.code] }}</span>
              <span class="points sentinel-mono">+{{ contribution.points }}</span>
            </li>
          }
        </ul>
      </div>
      <a class="action" routerLink="/alerts">View Full Analysis <sentinel-icon name="arrowRight" [size]="14" /></a>
    } @else {
      <p class="empty">No account in focus yet.</p>
    }
  `,
  styleUrl: './risk-analysis.css',
})
export class RiskAnalysis {
  readonly view = input<RiskAnalysisView | null>(null);
  protected readonly radius = RING_RADIUS;
  protected readonly shortLabel = SHORT_LABELS;
  protected readonly dash = computed(() => {
    const filled = ((this.view()?.score ?? 0) / 100) * RING_LENGTH;
    return `${filled.toFixed(1)} ${RING_LENGTH.toFixed(1)}`;
  });
}
