import type { EvidenceBundle } from '@sentinel/domain';

/** The bundle for one recorded assessment; the assessment names its account. */
export interface CompileEvidenceBundle {
  compile(assessmentId: string): Promise<EvidenceBundle>;
}
