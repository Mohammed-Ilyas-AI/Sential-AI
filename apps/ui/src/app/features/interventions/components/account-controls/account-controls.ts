import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import type { CustomerContactChannel, CustomerContactOutcome } from '@sentinel/domain';
import { AccountControlsFacade } from '../../data-access/account-controls-facade';

type KillSwitchStep = 'IDLE' | 'REASON' | 'CONFIRM';

const CHANNELS: readonly { readonly value: CustomerContactChannel; readonly label: string }[] = [
  { value: 'PHONE', label: 'Phone' },
  { value: 'SECURE_MESSAGE', label: 'Secure message' },
  { value: 'IN_APP_PUSH', label: 'In-app push' },
];
const OUTCOMES: readonly { readonly value: CustomerContactOutcome; readonly label: string }[] = [
  { value: 'REACHED', label: 'Reached the customer' },
  { value: 'NO_ANSWER', label: 'No answer' },
  { value: 'MESSAGE_LEFT', label: 'Message left' },
  { value: 'NOTIFICATION_SENT', label: 'Notification sent' },
];

/**
 * The account's kill switch and customer contact. The switch needs a reason and a second confirmation naming the
 * account; only the customer's verification with the bank lifts it. A contact never releases a hold.
 */
@Component({
  selector: 'sentinel-account-controls',
  imports: [DatePipe],
  providers: [AccountControlsFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './account-controls.html',
  styleUrl: './account-controls.css',
})
export class AccountControls {
  readonly accountId = input.required<string>();
  readonly reference = input.required<string>();
  readonly transactionId = input<string | null>(null);

  protected readonly controls = inject(AccountControlsFacade);
  protected readonly step = signal<KillSwitchStep>('IDLE');
  protected readonly reason = signal('');
  protected readonly channel = signal<CustomerContactChannel>('PHONE');
  protected readonly outcome = signal<CustomerContactOutcome>('NO_ANSWER');
  protected readonly note = signal('');
  protected readonly channels = CHANNELS;
  protected readonly outcomes = OUTCOMES;

  constructor() {
    effect(() => {
      const accountId = this.accountId();
      untracked(() => {
        this.step.set('IDLE');
        this.reason.set('');
        this.controls.load(accountId);
      });
    });
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
  }

  protected confirmKillSwitch(): void {
    this.controls.activateKillSwitch(this.reason().trim());
    this.step.set('IDLE');
    this.reason.set('');
  }

  protected recordContact(): void {
    this.controls.recordContact(this.channel(), this.outcome(), this.note(), this.transactionId());
    this.note.set('');
  }
}
