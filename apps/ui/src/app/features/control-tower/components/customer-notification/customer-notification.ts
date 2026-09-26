import { ChangeDetectionStrategy, Component } from '@angular/core';

/** The mock mobile-banking push shown when a transfer enters HOLD. */
@Component({
  selector: 'sentinel-customer-notification',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<aside aria-label="Customer notification"></aside>`,
})
export class CustomerNotification {}
