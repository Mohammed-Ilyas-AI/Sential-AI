import { MongoClient, MongoServerError, type Db } from 'mongodb';

export type MongoDatabase = Db;

export interface MongoConnectionSettings {
  readonly uri: string;
  readonly database: string;
}

export interface MongoConnection {
  readonly database: MongoDatabase;
  close(): Promise<void>;
}

/** One client and one pool per process, created at startup and never per request. */
export async function connectMongo(settings: MongoConnectionSettings, appName = 'sentinel-core'): Promise<MongoConnection> {
  const client = new MongoClient(settings.uri, { appName, ignoreUndefined: true });
  await client.connect();
  return { database: client.db(settings.database), close: () => client.close() };
}

const DUPLICATE_KEY = 11_000;

export function isDuplicateKeyError(error: unknown): boolean {
  return error instanceof MongoServerError && error.code === DUPLICATE_KEY;
}
