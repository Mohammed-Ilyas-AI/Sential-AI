import type { CaseStatus, RiskBand } from '@sentinel/domain';

export interface CaseListItem {
  readonly caseId: string;
  readonly accountId: string;
  readonly status: CaseStatus;
  readonly band: RiskBand;
}
