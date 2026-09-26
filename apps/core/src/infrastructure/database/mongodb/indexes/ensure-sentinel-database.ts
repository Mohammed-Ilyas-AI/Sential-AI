import { MongoServerError } from 'mongodb';
import type { MongoDatabase } from '../client/mongo-connection.js';
import type { CollectionDefinition } from '../collections/collection-definition.js';
import { SENTINEL_COLLECTIONS } from '../collections/sentinel-collections.js';

export interface DatabaseSetupReport {
  readonly createdCollections: readonly string[];
  readonly ensuredIndexes: readonly string[];
}

const NAMESPACE_EXISTS = 48;

/**
 * Creates any missing collection and every documented index. Idempotent and safe to run on every startup and
 * from several instances at once; nobody creates collections by hand in the Atlas UI.
 */
export async function ensureSentinelDatabase(
  database: MongoDatabase,
  collections: readonly CollectionDefinition[] = SENTINEL_COLLECTIONS,
): Promise<DatabaseSetupReport> {
  const existing = new Set((await database.listCollections({}, { nameOnly: true }).toArray()).map((collection) => collection.name));
  const createdCollections: string[] = [];
  const ensuredIndexes: string[] = [];

  for (const definition of collections) {
    if (!existing.has(definition.name)) {
      try {
        await database.createCollection(definition.name);
        createdCollections.push(definition.name);
      } catch (error) {
        if (!(error instanceof MongoServerError && error.code === NAMESPACE_EXISTS)) throw error;
      }
    }
    if (definition.indexes.length > 0) {
      const names = await database.collection(definition.name).createIndexes([...definition.indexes]);
      ensuredIndexes.push(...names.map((name) => `${definition.name}.${name}`));
    }
  }
  return { createdCollections, ensuredIndexes };
}
