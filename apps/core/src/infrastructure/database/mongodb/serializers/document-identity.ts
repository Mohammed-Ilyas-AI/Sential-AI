/** Strips storage-only fields so a document reads back as its domain record. */
export function withoutStorageFields<TDocument extends { readonly _id: unknown }>(
  document: TDocument,
): Omit<TDocument, '_id' | 'ordinal'> {
  const { _id, ordinal, ...record } = document as TDocument & { readonly ordinal?: unknown };
  return record;
}
