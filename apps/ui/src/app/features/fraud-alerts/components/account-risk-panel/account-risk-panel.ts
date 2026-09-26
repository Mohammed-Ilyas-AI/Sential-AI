import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { AccountRiskView } from '../../models/account-risk-view';

/** Right rail: balance at window start, 24h transferred, drain against the 50% line, score, band and signals. */
@Component({
  selector: 'sentinel-account-risk-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section aria-label="Account risk"></section>`,
})
export class AccountRiskPanel {
  readonly account = input<AccountRiskView | null>(null);
}
