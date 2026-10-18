import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Store } from '@ngrx/store';
import type { CustomerContactChannel, CustomerContactOutcome, CustomerContactRecord, KillSwitchRecord, KillSwitchStatus } from '@sentinel/domain';
import { finalize, forkJoin, type Observable } from 'rxjs';
import { CoreApiClient } from '../../../core/http/api-client/core-api-client';
import { sessionFeature } from '../../../state/session/session.feature';

export type ControlAction = 'ACTIVATE' | 'LIFT' | 'CONTACT';

interface Written<TRecord> {
  readonly outcome: 'CREATED' | 'DUPLICATE';
  readonly record: TRecord;
}

function failureMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return 'The action could not be recorded.';
  if (error.status === 0) return 'sentinel-core is unreachable; nothing was recorded.';
  if (error.status === 403) return 'This account belongs to another institution under the current data lens.';
  const detail = typeof error.error === 'object' && error.error !== null && 'detail' in error.error ? String((error.error as { detail: unknown }).detail) : null;
  return detail ?? `sentinel-core refused the action (HTTP ${error.status}); nothing was recorded.`;
}

/**
 * The account-level exceptions (M§5.3) for one account: the kill switch and recorded customer contact. Every
 * change is sentinel-core's record coming back; a retried click carries the same idempotency key.
 */
@Injectable()
export class AccountControlsFacade {
  private readonly api = inject(CoreApiClient);
  private readonly analyst = inject(Store).selectSignal(sessionFeature.selectAnalystIdentity);

  readonly accountId = signal<string | null>(null);
  readonly killSwitch = signal<KillSwitchStatus | null>(null);
  readonly contacts = signal<readonly CustomerContactRecord[]>([]);
  readonly loading = signal(false);
  readonly busy = signal<ControlAction | null>(null);
  readonly failure = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  private pendingKeys = new Map<ControlAction, string>();

  load(accountId: string | null): void {
    this.accountId.set(accountId);
    this.killSwitch.set(null);
    this.contacts.set([]);
    this.failure.set(null);
    this.notice.set(null);
    this.pendingKeys = new Map();
    if (!accountId) return;
    this.loading.set(true);
    const encoded = encodeURIComponent(accountId);
    forkJoin({
      killSwitch: this.api.get<KillSwitchStatus>(`/v1/accounts/${encoded}/kill-switch`),
      contacts: this.api.get<{ contacts: readonly CustomerContactRecord[] }>(`/v1/accounts/${encoded}/customer-contacts`),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ killSwitch, contacts }) => {
          if (this.accountId() !== accountId) return;
          this.killSwitch.set(killSwitch);
          this.contacts.set(contacts.contacts);
        },
        error: (error: unknown) => this.failure.set(failureMessage(error)),
      });
  }

  activateKillSwitch(reason: string): void {
    const accountId = this.accountId();
    if (!accountId) return;
    this.run(
      'ACTIVATE',
      this.api.post<Written<KillSwitchRecord>>(`/v1/accounts/${encodeURIComponent(accountId)}/kill-switch`, {
        analystIdentity: this.analyst(),
        reason,
        confirmAccountId: accountId,
        idempotencyKey: this.keyFor('ACTIVATE'),
      }),
      (written) => {
        this.appendKillSwitch(written.record);
        this.notice.set('Kill switch active: every eligible outflow on this account is now held pending customer verification.');
      },
    );
  }

  /** The simulated bank callback once the customer has verified with the bank. Recorded as the customer, not the analyst. */
  liftAfterCustomerVerification(): void {
    const accountId = this.accountId();
    if (!accountId) return;
    this.run(
      'LIFT',
      this.api.post<Written<KillSwitchRecord>>(`/v1/accounts/${encodeURIComponent(accountId)}/kill-switch/customer-verified-release`, {
        idempotencyKey: this.keyFor('LIFT'),
      }),
      (written) => {
        this.appendKillSwitch(written.record);
        this.notice.set('Kill switch lifted after customer verification. Transfers it already held stay held until each is resolved.');
      },
    );
  }

  recordContact(channel: CustomerContactChannel, outcome: CustomerContactOutcome, note: string, transactionId: string | null): void {
    const accountId = this.accountId();
    if (!accountId) return;
    this.run(
      'CONTACT',
      this.api.post<Written<CustomerContactRecord>>(`/v1/accounts/${encodeURIComponent(accountId)}/customer-contacts`, {
        analystIdentity: this.analyst(),
        channel,
        outcome,
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(transactionId ? { transactionId } : {}),
        idempotencyKey: this.keyFor('CONTACT'),
      }),
      (written) => {
        this.contacts.update((contacts) => [written.record, ...contacts.filter((contact) => contact.id !== written.record.id)]);
        this.notice.set('Contact attempt recorded (simulated channel; no real customer was contacted).');
      },
    );
  }

  /** One key per attempt: reused if the same attempt is retried after a failure, new once it succeeds. */
  private keyFor(action: ControlAction): string {
    const existing = this.pendingKeys.get(action);
    if (existing) return existing;
    const key = `${action.toLowerCase()}-${crypto.randomUUID()}`;
    this.pendingKeys.set(action, key);
    return key;
  }

  private appendKillSwitch(record: KillSwitchRecord): void {
    const current = this.killSwitch();
    const history = [...(current?.history ?? []).filter((entry) => entry.id !== record.id), record];
    this.killSwitch.set({ accountId: record.accountId, active: record.state === 'ACTIVE', history });
  }

  private run<T>(action: ControlAction, request: Observable<T>, onSuccess: (result: T) => void): void {
    if (this.busy()) return;
    this.busy.set(action);
    this.failure.set(null);
    this.notice.set(null);
    request.pipe(finalize(() => this.busy.set(null))).subscribe({
      next: (result) => {
        this.pendingKeys.delete(action);
        onSuccess(result);
      },
      error: (error: unknown) => this.failure.set(failureMessage(error)),
    });
  }
}
