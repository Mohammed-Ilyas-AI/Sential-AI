import { setServers } from 'node:dns';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ENV_FILE = fileURLToPath(new URL('../../../../.env', import.meta.url));

if (existsSync(REPOSITORY_ENV_FILE)) process.loadEnvFile(REPOSITORY_ENV_FILE);

/**
 * Integration tests only, never the gateway: on some developer machines Node's resolver points at a local stub
 * that refuses SRV queries, so `mongodb+srv://` cannot be expanded even though the OS resolves it. Public
 * resolvers are used for the test process's SRV/TXT lookups; host addresses still resolve through the OS.
 */
export const INTEGRATION_DNS_SERVERS = ['8.8.8.8', '1.1.1.1'] as const;
setServers([...INTEGRATION_DNS_SERVERS]);

/** The Atlas connection comes only from MONGODB_URI in a local, gitignored .env; it is never printed. */
export const ATLAS_URI = process.env['MONGODB_URI']?.trim() || undefined;

/** A throwaway database per run, so integration tests can never touch the application or demo data. */
export const INTEGRATION_DATABASE = `${process.env['MONGODB_DATABASE']?.trim() || 'sentinel_ai'}_it_stream_${Date.now().toString(36)}`;
