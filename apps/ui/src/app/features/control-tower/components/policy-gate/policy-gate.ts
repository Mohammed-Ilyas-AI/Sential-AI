import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../../../shared/ui/icon/icon';
import type { PolicyGateView } from '../../models/operations-overview';

/** SG-RD-50 for the account in focus: the outcome as a fact, the drain against the published line, the next step. */
@Component({
  selector: 'sentinel-policy-gate',
  imports: [DecimalPipe, Icon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2>Policy Gate</h2>
    @if (view(); as view) {
      <div class="rule" [attr.data-decision]="view.decision">
        <span class="badge">
          <sentinel-icon [name]="view.decision === 'ALLOW' ? 'shieldCheck' : 'lock'" [size]="20" />
          {{ view.decision }}
        </span>
        <span class="rule-text">
          <span class="rule-name">SG-RD-50 Rapid Drain Rule</span>
          <span class="rule-detail">24h outflow {{ view.drainPct | number: '1.1-1' }}% (&gt; {{ view.gatePercent }}%)</span>
        </span>
      </div>
      <div class="meter" role="meter" aria-label="24-hour outflow against the gate" [attr.aria-valuenow]="view.drainPct" aria-valuemin="0" aria-valuemax="100">
        <span class="reading sentinel-mono" [style.left.%]="fill()">{{ view.drainPct | number: '1.0-0' }}%</span>
        <div class="track">
          <span class="fill" [class.over]="view.drainPct > view.gatePercent" [style.width.%]="fill()"></span>
          <span class="threshold" [style.left.%]="view.gatePercent"></span>
        </div>
        <span class="threshold-label sentinel-mono" [style.left.%]="view.gatePercent">{{ view.gatePercent }}%</span>
      </div>
      <div class="intervention" [class.pending]="view.interventionTitle === 'Intervention required'">
        <span class="intervention-icon"><sentinel-icon [name]="view.interventionTitle === 'Intervention required' ? 'explain' : 'check'" [size]="20" /></span>
        <span>
          <span class="intervention-title">{{ view.interventionTitle }}</span>
          <span class="intervention-detail">{{ view.interventionDetail }}</span>
        </span>
      </div>
      <a class="action" routerLink="/alerts">View Intervention <sentinel-icon name="arrowRight" [size]="14" /></a>
    } @else {
      <p class="empty">The gate has not evaluated a transfer yet.</p>
    }
  `,
  styleUrl: './policy-gate.css',
})
export class PolicyGate {
  readonly view = input<PolicyGateView | null>(null);
  protected readonly fill = computed(() => Math.min(100, Math.max(0, this.view()?.drainPct ?? 0)));
}
