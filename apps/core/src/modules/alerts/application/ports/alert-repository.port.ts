import type { Alert } from '@sentinel/domain';

/** `alerts`: one open alert per account, watched by sentinel-stream. */
export interface AlertRepository {
  findOpenByAccountId(accountId: string): Promise<Alert | null>;
  findById(alertId: string): Promise<Alert | null>;
  save(alert: Alert): Promise<void>;
}
