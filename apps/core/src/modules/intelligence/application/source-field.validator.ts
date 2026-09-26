import type { CaseSummary } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';

/**
 * The hallucination guardrail: every claim must cite a field that exists in the bundle that was sent.
 * A claim citing nothing is dropped before it reaches the analyst.
 */
export class SourceFieldValidator {
  groundedIn(): CaseSummary {
    throw new NotYetImplementedError('sourceField grounding', 'scheduled for build order step 9');
  }
}
