import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { InstitutionLabelPipe } from '../../../../shared/pipes/institution-label/institution-label-pipe';
import { MinorUnitsCurrencyPipe } from '../../../../shared/pipes/minor-units-currency/minor-units-currency-pipe';
import type { HoldNotice } from '../../../../state/account-focus/account-focus.selectors';

/** The mock mobile-banking push shown when a transfer enters HOLD. Synthetic bank, no real branding. */
@Component({
  selector: 'sentinel-customer-notification',
  imports: [DatePipe, InstitutionLabelPipe, MinorUnitsCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside aria-label="Customer notification" aria-live="polite">
      <p class="from">{{ notice().institutionId | institutionLabel }} · mock customer notification</p>
      <p class="message">
        We have paused your transfer of {{ notice().amount | minorUnitsCurrency }} to protect your account.
        @if (notice().holdUntil; as holdUntil) {
          It will be released automatically at {{ holdUntil | date: 'd MMM HH:mm:ss' : 'UTC' }} UTC unless you cancel it.
        }
        If you did not make this transfer, contact your bank using the number on your card.
      </p>
    </aside>
  `,
  styles: `
    aside {
      padding: var(--sentinel-space-3);
      border: 1px solid var(--sentinel-color-border);
      border-radius: var(--sentinel-radius-medium);
      background: var(--sentinel-color-surface);
      border-left: 3px solid var(--sentinel-color-accent);
    }
    .from {
      margin: 0 0 var(--sentinel-space-1);
      color: var(--sentinel-color-text-muted);
      font-size: var(--sentinel-font-size-caption);
    }
    .message {
      margin: 0;
      font-size: var(--sentinel-font-size-caption);
    }
  `,
})
export class CustomerNotification {
  readonly notice = input.required<HoldNotice>();
}
