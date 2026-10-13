import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { DecisionRecord, Intervention } from '@sentinel/domain';
import { MinorUnitsCurrencyPipe } from '../../../../shared/pipes/minor-units-currency/minor-units-currency-pipe';
import { DecisionTrace } from '../../../../shared/ui/decision-trace/decision-trace';
import { RiskAttribution } from '../../../../shared/ui/risk-attribution/risk-attribution';
import { RiskBandBadge } from '../../../../shared/ui/risk-band-badge/risk-band-badge';

/**
 * The policy gate panel (M§5.3): the gate's outcome as a fact, the advisory score beside it, the contributions
 * and the decision trace. The analyst never approves or overturns the policy.
 */
@Component({
  selector: 'sentinel-policy-hold',
  imports: [DatePipe, DecimalPipe, MinorUnitsCurrencyPipe, DecisionTrace, RiskAttribution, RiskBandBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (decision(); as decision) {
      <section class="gate" [class.hold]="decision.decision === 'HOLD'" aria-labelledby="gate-title">
        <p class="caption">Policy gate · SG-RD-50</p>
        <h2 id="gate-title" class="state">{{ decision.decision }}</h2>
        <p class="outcome">{{ outcomeLabel() }}</p>
        <p class="why">
          {{ decision.amount | minorUnitsCurrency }} from {{ decision.accountReference ?? decision.accountId }} ·
          drain {{ decision.assessment.drain.drainPct | number: '1.1-1' }}% of
          {{ decision.assessment.drain.balanceAtWindowStart | minorUnitsCurrency }}
        </p>
        @if (intervention(); as intervention) {
          <p class="intervention">
            Intervention: <b>{{ intervention.state }}</b> by {{ intervention.actor }}
            at {{ intervention.actedAt | date: 'HH:mm:ss' : 'UTC' }} UTC
            @if (intervention.state === 'HELD' && intervention.holdUntil) {
              · auto-release {{ intervention.holdUntil | date: 'd MMM HH:mm:ss' : 'UTC' }} UTC
            }
          </p>
        }
        <p class="advisory">
          Advisory score <b class="sentinel-figures">{{ decision.riskScore }}</b>
          <sentinel-risk-band-badge [band]="decision.band" />
          <span class="note">The score explains; the gate decides.</span>
        </p>
      </section>
      <section class="card" aria-labelledby="contributions-title">
        <h2 id="contributions-title">Risk contributions</h2>
        <sentinel-risk-attribution [contributions]="decision.assessment.contributions" [score]="decision.riskScore" />
      </section>
      <section class="card" aria-labelledby="trace-title">
        <h2 id="trace-title">Decision trace</h2>
        <sentinel-decision-trace [decision]="decision" />
      </section>
    } @else {
      <section class="card" aria-label="Policy hold">
        <p class="empty">No account in focus.</p>
      </section>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--sentinel-space-3);
    }
    .card,
    .gate {
      background: var(--sentinel-color-surface);
      border: 1px solid var(--sentinel-color-border);
      border-radius: var(--sentinel-radius-medium);
      padding: var(--sentinel-space-4);
    }
    .gate.hold {
      border-color: var(--sentinel-color-hold);
      background: color-mix(in srgb, var(--sentinel-color-hold) 8%, var(--sentinel-color-surface));
    }
    h2 {
      margin: 0 0 var(--sentinel-space-3);
      font-size: var(--sentinel-font-size-body);
    }
    .caption,
    .why,
    .note,
    .empty,
    .intervention {
      margin: 0;
      color: var(--sentinel-color-text-muted);
      font-size: var(--sentinel-font-size-caption);
    }
    .state {
      margin: var(--sentinel-space-1) 0;
      font-size: var(--sentinel-font-size-display);
      font-weight: 700;
    }
    .hold .state {
      color: var(--sentinel-color-hold);
    }
    .outcome {
      margin: 0 0 var(--sentinel-space-2);
      font-weight: 600;
    }
    .intervention {
      margin-top: var(--sentinel-space-2);
      color: var(--sentinel-color-text);
    }
    .advisory {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sentinel-space-2);
      margin: var(--sentinel-space-3) 0 0;
    }
  `,
})
export class PolicyHold {
  readonly decision = input<DecisionRecord | null>(null);
  readonly intervention = input<Intervention | null>(null);

  protected readonly outcomeLabel = computed(() => {
    const decision = this.decision();
    if (!decision) return '';
    if (decision.decision === 'ALLOW') return 'Gate not met — no hold';
    const intervention = this.intervention();
    if (intervention && intervention.state !== 'HELD') return `Hold ended: ${intervention.state}`;
    return decision.decision === 'HOLD' ? '24-hour policy hold in force' : 'Rejected by policy';
  });
}
