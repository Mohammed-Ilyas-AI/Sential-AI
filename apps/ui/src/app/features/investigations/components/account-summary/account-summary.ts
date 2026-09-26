import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'sentinel-account-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section aria-label="Account summary"></section>`,
})
export class AccountSummary {}
