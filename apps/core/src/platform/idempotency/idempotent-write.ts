/** The outcome of a write keyed by idempotencyKey: a retry returns the record already stored. */
export type IdempotentWriteResult<TRecord> =
  | { readonly outcome: 'CREATED'; readonly record: TRecord }
  | { readonly outcome: 'DUPLICATE'; readonly record: TRecord };
