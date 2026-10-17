import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { DecisionRecord } from '@sentinel/domain';
import { MinorUnitsCurrencyPipe } from '../../../../shared/pipes/minor-units-currency/minor-units-currency-pipe';
import type { CaseListItem } from '../../models/case-list-item';

/** The recorded facts of the case: what the gate decided and why, straight from the decision record. */
@Component({
  selector: 'sentinel-case-detail',
  imports: [MinorUnitsCurrencyPipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dl>
      <div><dt>Case</dt><dd class="mono">{{ item().caseId }}</dd></div>
      <div><dt>Account</dt><dd class="mono">{{ item().reference }}</dd></div>
      @if (decision(); as decision) {
        <div><dt>Decision</dt><dd><b [class.hold]="decision.decision === 'HOLD'">{{ decision.decision }}</b> · {{ decision.reasonCodes.join(', ') }}</dd></div>
        <div><dt>Amount</dt><dd class="mono">{{ decision.amount | minorUnitsCurrency }}</dd></div>
        <div><dt>Drain</dt><dd class="mono">{{ decision.assessment.drain.drainPct | number: '1.1-1' }}% of {{ decision.assessment.drain.balanceAtWindowStart | minorUnitsCurrency }} in 24h</dd></div>
        <div><dt>Advisory score</dt><dd class="mono">{{ decision.riskScore }} {{ decision.band }}</dd></div>
        <div><dt>Policy</dt><dd class="mono">{{ decision.policyVersion }} · ruleset {{ decision.rulesetVersion }}</dd></div>
        <div><dt>Trace</dt><dd class="mono small">{{ decision.traceId }}</dd></div>
      }
    </dl>
    @if (decision(); as decision) {
      <p class="sentinel-eyebrow">Contributions</p>
      <ul>
        @for (contribution of decision.assessment.contributions; track contribution.code) {
          <li><span>{{ contribution.label }}</span><span class="mono">+{{ contribution.points }}</span></li>
        }
      </ul>
    }
  `,
  styles: `
    dl { display: grid; gap: var(--sentinel-space-2); margin: 0 0 var(--sentinel-space-3); font-size: var(--sentinel-font-size-caption); }
    dl div { display: grid; grid-template-columns: 120px 1fr; gap: var(--sentinel-space-2); }
    dt { color: var(--sentinel-color-text-secondary); }
    dd { margin: 0; overflow-wrap: anywhere; }
    .mono { font-family: var(--sentinel-font-family-mono); }
    .small { font-size: var(--sentinel-font-size-micro); }
    .hold { color: var(--sentinel-color-hold); }
    ul { display: grid; gap: var(--sentinel-space-1); margin: var(--sentinel-space-2) 0 0; padding: 0; list-style: none; font-size: var(--sentinel-font-size-caption); }
    li { display: flex; justify-content: space-between; }
  `,
})
export class CaseDetail {
  readonly item = input.required<CaseListItem>();
  readonly decision = input<DecisionRecord | null>(null);
}
