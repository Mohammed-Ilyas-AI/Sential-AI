import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RAPID_DRAIN_RULE_ID, type DecisionRecord } from '@sentinel/domain';

/**
 * A policy outcome is a fact, never a probability: rule SG-RD-50, the evidence, the decision source and the
 * ruleset and policy versions. Never a confidence figure.
 */
@Component({
  selector: 'sentinel-decision-trace',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-label="Decision trace">
      <dl>
        <dt>Rule</dt>
        <dd>{{ ruleId }}</dd>
        <dt>Decision</dt>
        <dd>{{ decision().decision }}</dd>
        <dt>Reason</dt>
        <dd>{{ decision().reasonCodes.join(', ') || '—' }}</dd>
        <dt>Decided by</dt>
        <dd>Deterministic policy gate</dd>
        <dt>Decided at</dt>
        <dd>{{ decision().decidedAt | date: 'HH:mm:ss' : 'UTC' }} UTC</dd>
        @if (decision().holdUntil; as holdUntil) {
          <dt>Hold until</dt>
          <dd>{{ holdUntil | date: 'd MMM HH:mm:ss' : 'UTC' }} UTC</dd>
        }
        <dt>Policy</dt>
        <dd>{{ decision().policyVersion }}</dd>
        <dt>Ruleset</dt>
        <dd>{{ decision().rulesetVersion }}</dd>
        <dt>Trace</dt>
        <dd class="trace">{{ decision().traceId }}</dd>
      </dl>
    </section>
  `,
  styles: `
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: var(--sentinel-space-1) var(--sentinel-space-4);
      margin: 0;
      font-size: var(--sentinel-font-size-caption);
    }
    dt {
      color: var(--sentinel-color-text-muted);
    }
    dd {
      margin: 0;
      text-align: right;
      font-family: var(--sentinel-font-family-mono);
      word-break: break-word;
    }
  `,
})
export class DecisionTrace {
  readonly decision = input.required<DecisionRecord>();
  protected readonly ruleId = RAPID_DRAIN_RULE_ID;
}
