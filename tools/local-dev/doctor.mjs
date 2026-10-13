// Local development preflight: `npm run doctor`. Checks everything a local run depends on and says, in plain
// words, what to fix. Never prints the connection string, the password or any other secret.
import { promises as dns, setServers } from 'node:dns';
import { createServer } from 'node:net';
import process from 'node:process';
import { MongoClient } from 'mongodb';

const out = (line) => process.stdout.write(`${line}\n`);
const results = [];
const pass = (label, detail = '') => results.push({ ok: true, label, detail });
const fail = (label, fix) => results.push({ ok: false, label, detail: fix });

const env = process.env;
const REQUIRED_KEYS = [
  'MONGODB_URI',
  'MONGODB_DATABASE',
  'CORS_ALLOWED_ORIGIN',
  'PUBSUB_PUSH_VERIFICATION',
  'STREAM_ALLOWED_ORIGIN',
  'SIMULATOR_CORE_BASE_URL',
  'SIMULATOR_EVENT_TRANSPORT',
];

// 1. Node version
const major = Number(process.versions.node.split('.')[0]);
if (major === 24) pass('Node.js 24', `v${process.versions.node}`);
else fail(`Node.js 24 (found v${process.versions.node})`, 'Install Node.js 24 LTS from nodejs.org, then run "npm ci".');

// 2. .env keys
const missing = REQUIRED_KEYS.filter((key) => !env[key]?.trim());
if (missing.length === 0) pass('.env has every required key');
else fail(`.env is missing: ${missing.join(', ')}`, 'Copy the missing lines from .env.example into .env and fill them in.');
if (env.SIMULATOR_EVENT_TRANSPORT && env.SIMULATOR_EVENT_TRANSPORT !== 'direct-push') {
  fail('SIMULATOR_EVENT_TRANSPORT is not direct-push', 'Set SIMULATOR_EVENT_TRANSPORT=direct-push in .env for a local run (no Pub/Sub needed).');
}
if (env.PUBSUB_PUSH_VERIFICATION && env.PUBSUB_PUSH_VERIFICATION !== 'disabled-for-local-development') {
  fail('PUBSUB_PUSH_VERIFICATION is not disabled locally', 'Set PUBSUB_PUSH_VERIFICATION=disabled-for-local-development in .env for a local run.');
}

// 3. MongoDB Atlas
const uri = env.MONGODB_URI?.trim() ?? '';
let host = '';
try {
  host = new URL(uri).hostname;
} catch {
  host = '';
}
if (!uri) {
  // already reported as a missing key
} else if (/[<>]/.test(uri) || !host) {
  fail('MONGODB_URI looks like a placeholder', 'Paste the full connection string from Atlas: Connect > Drivers, with your real password.');
} else {
  const devServers = (env.SENTINEL_DEV_DNS_SERVERS ?? '').split(',').map((server) => server.trim()).filter(Boolean);
  if (devServers.length > 0) setServers(devServers);

  let dnsOk = true;
  if (uri.startsWith('mongodb+srv://')) {
    try {
      const records = await dns.resolveSrv(`_mongodb._tcp.${host}`);
      pass('Atlas address resolves', `${records.length} cluster nodes`);
    } catch (error) {
      dnsOk = false;
      if (error?.code === 'ENOTFOUND' || error?.code === 'ENODATA') {
        fail('Atlas cluster address not found', 'The host part of MONGODB_URI is wrong. Copy it again from Atlas: Connect > Drivers.');
      } else {
        fail('Node cannot look up the Atlas address (querySrv)', 'Add SENTINEL_DEV_DNS_SERVERS=8.8.8.8,1.1.1.1 to .env.');
      }
    }
  }

  if (dnsOk) {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 12_000, appName: 'sentinel-doctor' });
    try {
      await client.connect();
      await client.db(env.MONGODB_DATABASE || 'sentinel_ai').command({ ping: 1 });
      pass('Atlas accepts this machine and the login', `database "${env.MONGODB_DATABASE || 'sentinel_ai'}"`);
      const hello = await client.db('admin').command({ hello: 1 });
      if (hello.setName) pass('Atlas is a replica set (live stream supported)');
      else fail('Atlas is not a replica set', 'Use an Atlas cluster (M0 or larger); change streams need a replica set.');
    } catch (error) {
      const text = `${error?.message ?? ''} ${error?.cause?.message ?? ''}`;
      if (/SSL alert number 80|tlsv1 alert internal error/i.test(text)) {
        fail('Atlas is refusing this machine\'s IP address', 'Atlas > Security > Network Access > Add IP Address > Add Current IP Address, wait until Active, then retry.');
      } else if (/bad auth|authentication failed/i.test(text) || error?.code === 18) {
        fail('Atlas rejected the username or password', 'Atlas > Security > Database Access: reset the password, then update MONGODB_URI (URL-encode special characters).');
      } else if (/querySrv|ECONNREFUSED/i.test(text)) {
        fail('Node cannot reach Atlas over DNS', 'Add SENTINEL_DEV_DNS_SERVERS=8.8.8.8,1.1.1.1 to .env.');
      } else if (/timed out|Server selection/i.test(text)) {
        fail('Atlas did not answer in time', 'Check your internet connection and Atlas > Network Access, then retry.');
      } else {
        fail('Could not connect to Atlas', (error?.name ?? 'Error') + ' (details hidden to avoid printing secrets)');
      }
    } finally {
      await client.close().catch(() => undefined);
    }
  }
}

// 4. Ports
const portFree = (port) =>
  new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port);
  });
for (const [port, service] of [[8080, 'core'], [8081, 'stream'], [4200, 'ui']]) {
  if (await portFree(port)) pass(`Port ${port} is free (${service})`);
  else fail(`Port ${port} is already in use (${service})`, 'Stop the other process using it (a previous "npm run dev"?), then retry.');
}

// Report
out('');
out('SENTINEL AI local preflight');
out('───────────────────────────');
for (const result of results) {
  out(`${result.ok ? '  ✔' : '  ✘'} ${result.label}${result.ok && result.detail ? `  (${result.detail})` : ''}`);
  if (!result.ok) out(`      → ${result.detail}`);
}
const failures = results.filter((result) => !result.ok).length;
out('');
out(failures === 0 ? 'All checks passed. Run "npm run demo".' : `${failures} check(s) failed. Fix the items marked ✘ and run "npm run doctor" again.`);
process.exitCode = failures === 0 ? 0 : 1;
