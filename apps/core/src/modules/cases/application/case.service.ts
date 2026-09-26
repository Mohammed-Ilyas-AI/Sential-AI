import type { Case } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';
import type { IdGenerator } from '../../../platform/ids/id-generator.js';
import type { CompileEvidenceBundle } from '../../investigations/application/compile-evidence-bundle.use-case.js';
import type { ExplainAndSummarise } from '../../intelligence/application/explain-and-summarise.use-case.js';
import type { ManageCase } from './manage-case.use-case.js';
import type { CaseRepository } from './ports/case-repository.port.js';

export class CaseService implements ManageCase {
  constructor(
    private readonly cases: CaseRepository,
    private readonly evidence: CompileEvidenceBundle,
    private readonly intelligence: ExplainAndSummarise,
    private readonly ids: IdGenerator,
  ) {}

  openFromAlert(): Promise<Case> {
    throw new NotYetImplementedError('Open case from alert', 'scheduled for build order step 10');
  }

  escalate(): Promise<Case> {
    throw new NotYetImplementedError('Case escalation', 'scheduled for build order step 10');
  }
}
