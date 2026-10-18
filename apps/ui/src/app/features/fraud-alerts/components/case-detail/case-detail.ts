import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RAPID_DRAIN_GATE_PERCENT } from '@sentinel/domain';
import { InstitutionLabelPipe } from '../../../../shared/pipes/institution-label/institution-label-pipe';
import { MinorUnitsCurrencyPipe } from '../../../../shared/pipes/minor-units-currency/minor-units-currency-pipe';
import { Icon } from '../../../../shared/ui/icon/icon';
import { RiskAttribution } from '../../../../shared/ui/risk-attribution/risk-attribution';
import { FraudAlertsFacade } from '../../data-access/fraud-alerts-facade';
import { AccountTimeline } from '../account-timeline/account-timeline';
import { CustomerNotification } from '../customer-notification/customer-notification';
import { HoldActions } from '../hold-actions/hold-actions';

/** The HTML reference colours the meter amber above 35% drain; the gate line itself is the policy percentage. */
const DRAIN_METER_NEAR_PERCENT = 35;

/**
 * The selected alert as a case: the gate's recorded policy decision and the current intervention status side by
 * side and never merged (a HOLD that was later RELEASED shows both), the rapid-drain arithmetic, the rule
 * contributions, the event timeline and the analyst's actions. Every value is the record's own.
 */
@Component({
  selector: 'sentinel-case-detail',
  imports: [DatePipe, DecimalPipe, RouterLink, InstitutionLabelPipe, MinorUnitsCurrencyPipe, Icon, RiskAttribution, AccountTimeline, CustomerNotification, HoldActions],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './case-detail.html',
  styleUrl: './case-detail.css',
})
export class CaseDetail {
  protected readonly facade = inject(FraudAlertsFacade);
  readonly trace = output<void>();
  protected readonly gatePercent = RAPID_DRAIN_GATE_PERCENT;

  protected readonly drainState = computed(() => {
    const account = this.facade.selectedAccount();
    if (!account) return 'under';
    if (account.exclusionReason) return 'excluded';
    if (!account.protectedAccount) return 'unprotected';
    if (account.thresholdMet) return 'over';
    return account.drainPct > DRAIN_METER_NEAR_PERCENT ? 'near' : 'under';
  });
  protected readonly drainLabel = computed(() => {
    switch (this.drainState()) {
      case 'excluded':
        return `Excluded (${this.facade.selectedAccount()?.exclusionReason ?? ''})`;
      case 'unprotected':
        return 'Below protected balance';
      case 'over':
        return 'Threshold exceeded';
      case 'near':
        return 'Approaching threshold';
      default:
        return 'Under threshold';
    }
  });
  protected readonly meterWidth = computed(() => Math.min(100, Math.max(0, this.facade.selectedAccount()?.drainPct ?? 0)));
  /** The SG-RD-50 rule, written out once for the policy box. */
  protected readonly ruleLabel = computed(() => (this.facade.focusedDecision()?.reasonCodes ?? []).join(', ') || '—');
}
