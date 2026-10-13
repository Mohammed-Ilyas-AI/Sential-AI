// Local development only: waits until every URL given on the command line answers, then exits 0.
// Used by `npm run demo` to start the simulator only once core, stream and the UI are up.
import process from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';

const urls = process.argv.slice(2);
const deadline = Date.now() + 180_000;

async function answers(url) {
  try {
    const response = await globalThis.fetch(url, { signal: AbortSignal.timeout(2_000) });
    return response.ok;
  } catch {
    return false;
  }
}

while (Date.now() < deadline) {
  const ready = await Promise.all(urls.map(answers));
  if (ready.every(Boolean)) {
    process.stdout.write('[demo] core, stream and UI are up: starting DEMO_TAKEOVER_01. Open http://localhost:4200\n');
    process.exit(0);
  }
  await sleep(2_000);
}
process.stderr.write(`[demo] gave up waiting for: ${urls.join(', ')}. Run "npm run doctor".\n`);
process.exit(1);
