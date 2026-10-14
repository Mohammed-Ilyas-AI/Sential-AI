import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MinorUnitsCurrencyPipe } from '../../../../shared/pipes/minor-units-currency/minor-units-currency-pipe';
import { Icon } from '../../../../shared/ui/icon/icon';
import { FraudAlertsFacade, type InterventionAction } from '../../data-access/fraud-alerts-facade';

interface ArmedAction {
  readonly action: InterventionAction;
  readonly transactionId: string;
}

const ACTION_LABELS: Readonly<Record<InterventionAction, { readonly label: string; readonly confirm: string }>> = {
  'customer-verified-release': { label: 'Release · customer verified', confirm: 'Confirm the customer verified with the bank' },
  'customer-cancellation': { label: 'Cancel · customer request', confirm: 'Confirm the customer cancelled this transfer' },
  'fraud-confirmation': { label: 'Confirm fraud', confirm: 'Confirm fraud and reject, as' },
};

/**
 * The exceptions an analyst works around a policy hold (M§5.3): release only after the customer has verified
 * with the bank, cancellation at the customer's request, and fraud confirmation under the analyst's identity.
 * Each is recorded append-only by sentinel-core; nothing here releases a hold on judgement, and every action
 * takes a second, explicit confirmation.
 */
@Component({
  selector: 'sentinel-hold-actions',
  imports: [DatePipe, Icon, MinorUnitsCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card" aria-labelledby="hold-actions-title">
      <header>
        <h2 id="hold-actions-title">Held transfers</h2>
        @if (facade.focusedHolds().length > 0) {
          <span class="state sentinel-mono"><sentinel-icon name="lock" [size]="12" /> Account in hold state</span>
        }
      </header>
      @if (facade.focusedHolds().length > 0) {
        <p class="note">
          Every subsequent eligible outflow on this account is held until the cooling period ends or the customer verifies.
          Standing instructions, GIRO/eGIRO and designated bill payments continue.
        </p>
        <ul>
          @for (hold of facade.focusedHolds(); track hold.intervention.transactionId) {
            <li>
              <div class="row">
                <span class="what">
                  <b class="sentinel-figures">{{ hold.amount === null ? '—' : (hold.amount | minorUnitsCurrency) }}</b>
                  <span class="sentinel-mono id">{{ hold.intervention.transactionId }}</span>
                </span>
                <span class="why" [class.cascade]="hold.cascaded">{{ hold.cascaded ? 'Hold cascade' : 'Threshold breach' }}</span>
              </div>
              <p class="detail">
                @if (hold.intervention.holdUntil) {
                  Auto-release {{ hold.intervention.holdUntil | date: 'd MMM HH:mm:ss' : 'UTC' }} UTC
                }
                @if (hold.intervention.cascadeOfTransactionId; as trigger) {
                  · after <span class="sentinel-mono">{{ trigger }}</span>
                }
              </p>
              @if (armed(); as choice) {
                @if (choice.transactionId === hold.intervention.transactionId) {
                  <div class="confirm" role="group" [attr.aria-label]="'Confirm ' + labels[choice.action].label">
                    <span>{{ labels[choice.action].confirm }}{{ choice.action === 'fraud-confirmation' ? ' ' + (facade.analystIdentity() ?? '') : '' }}?</span>
                    <button type="button" class="primary" [disabled]="facade.pendingAction() !== null" (click)="confirm(choice)">Record</button>
                    <button type="button" (click)="armed.set(null)">Back</button>
                  </div>
                }
              }
              @if (armed()?.transactionId !== hold.intervention.transactionId) {
                <div class="actions">
                  @for (action of actions; track action) {
                    <button type="button" [attr.data-action]="action" [disabled]="facade.pendingAction() !== null" (click)="arm(action, hold.intervention.transactionId)">
                      {{ labels[action].label }}
                    </button>
                  }
                </div>
              }
            </li>
          }
        </ul>
        @if (facade.actionFailure(); as failure) {
          <p class="failure" role="alert">{{ failure }}</p>
        }
      } @else {
        <p class="note">No transfer on this account is held.</p>
      }
    </section>
  `,
  styles: `
    .card {
      background: var(--sentinel-color-surface);
      border: 1px solid var(--sentinel-color-border);
      border-radius: var(--sentinel-radius-medium);
      padding: var(--sentinel-space-4);
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sentinel-space-2);
      margin-bottom: var(--sentinel-space-2);
    }
    h2 {
      margin: 0;
      font-size: var(--sentinel-font-size-body);
    }
    .state {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: var(--sentinel-radius-pill);
      background: color-mix(in srgb, var(--sentinel-color-hold, var(--sentinel-color-warning)) 16%, transparent);
      color: var(--sentinel-color-hold, var(--sentinel-color-warning));
      font-size: var(--sentinel-font-size-micro);
    }
    .note,
    .detail,
    .failure {
      margin: 0;
      color: var(--sentinel-color-text-muted);
      font-size: var(--sentinel-font-size-caption);
    }
    .failure {
      margin-top: var(--sentinel-space-2);
      color: var(--sentinel-color-critical);
    }
    ul {
      list-style: none;
      margin: var(--sentinel-space-3) 0 0;
      padding: 0;
      display: grid;
      gap: var(--sentinel-space-2);
    }
    li {
      display: grid;
      gap: var(--sentinel-space-1);
      padding: var(--sentinel-space-3);
      border: 1px solid var(--sentinel-color-border-soft);
      border-radius: var(--sentinel-radius-small);
    }
    .row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--sentinel-space-2);
    }
    .what {
      display: flex;
      align-items: baseline;
      gap: var(--sentinel-space-2);
      min-width: 0;
    }
    .id {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--sentinel-color-text-secondary);
      font-size: var(--sentinel-font-size-micro);
    }
    .why {
      flex: none;
      font-size: var(--sentinel-font-size-micro);
      color: var(--sentinel-color-text-secondary);
    }
    .why.cascade {
      color: var(--sentinel-color-warning);
    }
    .actions,
    .confirm {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sentinel-space-2);
      margin-top: var(--sentinel-space-1);
    }
    .confirm span {
      flex: 1 1 100%;
      font-size: var(--sentinel-font-size-caption);
    }
    button {
      min-height: 32px;
      padding: 0 var(--sentinel-space-3);
      border: 1px solid var(--sentinel-color-border-interactive);
      border-radius: var(--sentinel-radius-small);
      background: var(--sentinel-color-elevated);
      color: var(--sentinel-color-text);
      font: inherit;
      font-size: var(--sentinel-font-size-caption);
      cursor: pointer;
    }
    button:hover:not(:disabled) {
      border-color: var(--sentinel-color-accent);
    }
    button:focus-visible {
      outline: 2px solid var(--sentinel-color-accent);
      outline-offset: 2px;
    }
    button:disabled {
      opacity: 0.5;
      cursor: default;
    }
    button[data-action='fraud-confirmation'] {
      border-color: color-mix(in srgb, var(--sentinel-color-critical) 50%, transparent);
    }
    button.primary {
      border-color: var(--sentinel-color-accent);
      background: var(--sentinel-color-accent-soft);
    }
    @media (pointer: coarse) {
      button {
        min-height: var(--sentinel-touch-target);
      }
    }
  `,
})
export class HoldActions {
  protected readonly facade = inject(FraudAlertsFacade);
  protected readonly labels = ACTION_LABELS;
  protected readonly actions: readonly InterventionAction[] = ['customer-verified-release', 'customer-cancellation', 'fraud-confirmation'];
  protected readonly armed = signal<ArmedAction | null>(null);

  protected arm(action: InterventionAction, transactionId: string): void {
    this.armed.set({ action, transactionId });
  }

  protected confirm({ action, transactionId }: ArmedAction): void {
    this.facade.act(action, transactionId);
    this.armed.set(null);
  }
}
