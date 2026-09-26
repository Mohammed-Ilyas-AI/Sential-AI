import type { IndexDescription } from 'mongodb';

type Stored<TEntity> = TEntity & { readonly _id: string };

/** A domain record as stored: the domain shape plus a string _id, flattened so the driver accepts it. */
export type MongoDocument<TEntity> = { [Key in keyof Stored<TEntity>]: Stored<TEntity>[Key] };

export interface CollectionDefinition {
  readonly name: string;
  readonly indexes: readonly IndexDescription[];
}
