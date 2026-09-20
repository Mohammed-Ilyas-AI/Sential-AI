export type CurrencyCode = 'SGD' | 'USD' | 'INR';

/** Amounts are integers in minor units. Never use floating point for money. */
export interface Money {
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
}
