import type { Signal } from '@angular/core';
import type { Alert } from '@sentinel/domain';
import type { AccountRiskView } from '../models/account-risk-view';

export abstract class FraudAlertsFacade {
  /** Sorted by risk, newest critical first. */
  abstract readonly queue: Signal<readonly Alert[]>;
  abstract readonly selectedAccount: Signal<AccountRiskView | null>;
  abstract select(alertId: string): void;
}
