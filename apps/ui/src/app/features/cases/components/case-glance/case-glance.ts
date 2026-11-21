import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RAPID_DRAIN_GATE_PERCENT, type Case } from '@sentinel/domain';

/** A case at a glance: the recorded score and band, the 24h drain against the gate, and the rules that weighed most. */
@Component({
  selector: 'sentinel-case-glance',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-band]': 'case().evidence.assessment.band', role: 'group', 'aria-label': 'Case at a glance' },
  template: `
    <div class="ring" [style.--score]="case().evidence.assessment.score">
      <b>{{ case().evidence.assessment.score }}</b><small>{{ case().evidence.assessment.band }}</small>
    </div>
    <div class="drain">
      <span class="label">
        24h balance drain
        <em [class.over]="case().evidence.drain.thresholdMet">{{ case().evidence.drain.thresholdMet ? 'gate exceeded' : 'below gate' }}</em>
      </span>
      <b>{{ case().evidence.drain.drainPct | number: '1.1-1' }}%</b>
      <span class="bar"><span class="fill" [style.width.%]="drainWidth()"></span><span class="gate" [style.left.%]="gatePercent"></span></span>
    </div>
    <ul class="rules" aria-label="Strongest rules in the score">
      @for (rule of topRules(); track rule.code) {
        <li><span>{{ rule.label }}</span><b>+{{ rule.points }}</b></li>
      }
    </ul>
  `,
  styleUrl: './case-glance.css',
})
export class CaseGlance {
  readonly case = input.required<Case>();
  protected readonly gatePercent = RAPID_DRAIN_GATE_PERCENT;
  protected readonly drainWidth = computed(() => Math.min(100, this.case().evidence.drain.drainPct));
  /** The three rules that weighed most in the recorded score, strongest first. */
  protected readonly topRules = computed(() => [...this.case().evidence.assessment.contributions].sort((left, right) => right.points - left.points).slice(0, 3));
}
