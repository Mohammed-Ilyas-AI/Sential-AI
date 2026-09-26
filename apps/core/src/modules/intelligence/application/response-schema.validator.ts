import type { CaseSummary, RiskExplanation } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';

const STEP = 'scheduled for build order step 9';

/** Unparseable or schema-invalid output is rejected; the caller retries once, then falls back to the attribution. */
export class ResponseSchemaValidator {
  caseSummary(): CaseSummary | null {
    throw new NotYetImplementedError('CaseSummary schema validation', STEP);
  }

  riskExplanation(): RiskExplanation | null {
    throw new NotYetImplementedError('RiskExplanation schema validation', STEP);
  }
}
