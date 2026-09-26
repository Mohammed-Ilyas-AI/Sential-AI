import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ENV_FILE = fileURLToPath(new URL('../../../../.env', import.meta.url));

if (existsSync(REPOSITORY_ENV_FILE)) process.loadEnvFile(REPOSITORY_ENV_FILE);

/** The Atlas connection comes only from MONGODB_URI in a local, gitignored .env; it is never printed. */
export const ATLAS_URI = process.env['MONGODB_URI']?.trim() || undefined;

/** A throwaway database per run, so integration tests can never touch the application or demo data. */
export const INTEGRATION_DATABASE = `${process.env['MONGODB_DATABASE']?.trim() || 'sentinel_ai'}_it_${Date.now().toString(36)}`;
