import type { CaseSummary, EvidenceBundle } from '@sentinel/domain';

export interface GroundedSummary {
  readonly summary: CaseSummary;
  readonly droppedClaims: number;
}

/** `assessment.contributions[0].points` and `assessment.contributions.0.points` name the same field. */
function segmentsOf(sourceField: string): readonly string[] {
  return sourceField
    .trim()
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter((segment) => segment !== '');
}

function exists(root: unknown, sourceField: string): boolean {
  const segments = segmentsOf(sourceField);
  if (segments.length === 0) return false;
  let node: unknown = root;
  for (const segment of segments) {
    if (typeof node !== 'object' || node === null || !Object.hasOwn(node, segment)) return false;
    node = (node as Readonly<Record<string, unknown>>)[segment];
  }
  return node !== undefined;
}

/**
 * The hallucination guardrail (T§7): every claim must cite a field that exists in the bundle that was sent.
 * A claim citing nothing is dropped before it reaches the analyst; the count is reported, never hidden.
 */
export class SourceFieldValidator {
  /** The bundle that was sent, or, for the agent, only the sections it actually retrieved. */
  groundedIn(summary: CaseSummary, bundle: EvidenceBundle | Partial<Readonly<Record<keyof EvidenceBundle, unknown>>>): GroundedSummary {
    const evidence = summary.evidence.filter((item) => exists(bundle, item.sourceField));
    return { summary: { ...summary, evidence }, droppedClaims: summary.evidence.length - evidence.length };
  }
}
