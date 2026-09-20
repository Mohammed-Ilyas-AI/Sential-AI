import type { Money } from './money.js';

export type Channel = 'web' | 'mobile' | 'atm' | 'branch';

export interface Payee {
  readonly id: string;
  readonly name: string;
  readonly isNew: boolean;
  readonly countryCode: string;
}

export interface Transaction {
  readonly id: string;
  readonly accountId: string;
  readonly payee: Payee;
  readonly amount: Money;
  readonly channel: Channel;
  readonly deviceId: string | null;
  /** Source clock, ISO 8601. */
  readonly occurredAt: string;
  /** Our clock at ingest, ISO 8601. */
  readonly receivedAt: string;
}
