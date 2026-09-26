import type { Alert } from '@sentinel/domain';

/** `alerts`: the open alert queue, watched by sentinel-stream. */
export interface AlertRepository {
  raise(alert: Alert): Promise<void>;
  findOpenByAccountId(accountId: string): Promise<readonly Alert[]>;
}
