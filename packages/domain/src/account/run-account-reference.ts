/**
 * The display reference a synthetic account carries in one scenario run.
 *
 * Every run of a demo scenario plays on fresh, run-scoped synthetic accounts (their tokens already differ per run).
 * Their visible references must differ too, or every run shows the same "ACC-10291" across alerts, cases and the
 * tape. A run shifts every catalogue number by the same offset, derived from the run ID: references stay unique
 * within a run, differ between runs, and are reproducible from the run ID alone (the browser derives the same
 * reference from the run ID embedded in a transaction ID). Without a run ID the catalogue reference is unchanged.
 */
const SPAN = 90_000;
const FLOOR = 10_000;

function offsetOf(runId: string): number {
  // FNV-1a, 32-bit: deterministic, dependency-free; not a security boundary.
  let hash = 0x811c9dc5;
  for (let index = 0; index < runId.length; index += 1) {
    hash ^= runId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % SPAN;
}

export function runAccountReference(catalogueReference: string, runId?: string): string {
  const match = /^ACC-(\d{5})$/.exec(catalogueReference);
  if (!runId || !match) return catalogueReference;
  const number = ((Number(match[1]) - FLOOR + offsetOf(runId)) % SPAN) + FLOOR;
  return `ACC-${number}`;
}

/** The scenario code and run ID inside a scenario transaction ID (`TX-<code>-<runId>-<sequence>`), if it has them. */
export function scenarioRunOf(transactionId: string): { readonly code: string; readonly runId: string } | null {
  const match = /^TX-([A-Z0-9]+)-([A-Z0-9]{1,12})-\d+$/.exec(transactionId);
  return match ? { code: match[1] as string, runId: match[2] as string } : null;
}
