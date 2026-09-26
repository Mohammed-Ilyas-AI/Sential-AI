import type { EvidenceBundle } from '@sentinel/domain';

export interface CompileEvidenceBundle {
  compile(accountId: string, assessmentId: string): Promise<EvidenceBundle>;
}
