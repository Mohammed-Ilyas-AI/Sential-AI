import { MongoClient, type Db } from 'mongodb';

export interface StreamDatabase {
  readonly database: Db;
  close(): Promise<void>;
}

/** One read-only client for the change stream and snapshots; sentinel-stream never writes. */
export async function connectStreamDatabase(uri: string, databaseName: string): Promise<StreamDatabase> {
  const client = new MongoClient(uri, { appName: 'sentinel-stream' });
  await client.connect();
  return { database: client.db(databaseName), close: () => client.close() };
}
