import type { Case } from '@sentinel/domain';

/** "Investigate alert" opens a case; the analyst confirms fraud or escalates; the report renders recorded facts. */
export interface ManageCase {
  openFromAlert(alertId: string): Promise<Case>;
  escalate(caseId: string, analystIdentity: string): Promise<Case>;
}
