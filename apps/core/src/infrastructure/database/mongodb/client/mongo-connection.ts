import { MongoClient, type Db } from 'mongodb';

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
export async function connectMongo(settings: MongoConnectionSettings): Promise<MongoConnection> {
  const client = new MongoClient(settings.uri, { appName: 'sentinel-core' });
  await client.connect();
  return { database: client.db(settings.database), close: () => client.close() };
}
