import type { EvidenceBundle } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';
import type { CompileEvidenceBundle } from './compile-evidence-bundle.use-case.js';
import type { EvidenceSource } from './ports/evidence-source.port.js';

/** Assembles the one typed object Gemini receives: last 50 transactions, two hops capped at 40 nodes. */
export class EvidenceBundleCompiler implements CompileEvidenceBundle {
  constructor(private readonly evidence: EvidenceSource) {}

  compile(): Promise<EvidenceBundle> {
    throw new NotYetImplementedError('Evidence bundle', 'scheduled for build order step 10');
  }
}
