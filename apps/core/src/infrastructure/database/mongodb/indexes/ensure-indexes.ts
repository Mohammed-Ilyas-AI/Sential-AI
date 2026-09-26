import type { MongoDatabase } from '../client/mongo-connection.js';
import type { CollectionDefinition } from '../collections/collection-definition.js';
import { SENTINEL_COLLECTIONS } from '../collections/sentinel-collections.js';

/** Idempotent. Run deliberately against a provisioned cluster; creating an index also creates its collection. */
export async function ensureIndexes(
  database: MongoDatabase,
  collections: readonly CollectionDefinition[] = SENTINEL_COLLECTIONS,
): Promise<void> {
  for (const collection of collections) {
    if (collection.indexes.length > 0) {
      await database.collection(collection.name).createIndexes([...collection.indexes]);
    }
  }
}
