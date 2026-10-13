// Local development only, loaded by the `dev` scripts with --import; production never loads this file.
//
// On some machines Node's resolver points at a local stub that refuses the SRV query behind a
// mongodb+srv:// connection string, even though the operating system resolves it. Setting
// SENTINEL_DEV_DNS_SERVERS (for example "8.8.8.8,1.1.1.1") in the local .env sends Node's DNS queries
// to those resolvers for this process only. Unset, it does nothing.
import { setServers } from 'node:dns';

const servers = (globalThis.process?.env?.SENTINEL_DEV_DNS_SERVERS ?? '')
  .split(',')
  .map((server) => server.trim())
  .filter(Boolean);

if (servers.length > 0) setServers(servers);
