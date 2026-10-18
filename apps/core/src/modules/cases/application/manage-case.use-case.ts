import type { Case, CaseReport, CaseReportSectionId, CaseReportVersion } from '@sentinel/domain';
import type { ActingContext } from '../../audit/application/audit-trail.js';
import type { RenderedDocument } from './ports/report-document-renderer.port.js';

export interface Written<TRecord> {
  readonly outcome: 'CREATED' | 'DUPLICATE';
  readonly record: TRecord;
}

export interface SectionEdit {
  readonly id: CaseReportSectionId;
  readonly body: string;
}

/** "Investigate alert" opens a case; the analyst confirms fraud or escalates; the report renders recorded facts. */
export interface ManageCase {
  openFromAlert(context: ActingContext, alertId: string): Promise<Written<Case>>;
  escalate(context: ActingContext, caseId: string): Promise<Case>;
  get(context: ActingContext, caseId: string): Promise<Case>;
  list(context: ActingContext, limit: number): Promise<readonly Case[]>;
}

/**
 * The one-click case report (M§5.6): generated from the persisted case, edited as a draft, signed off by an
 * analyst, exported. A signed-off version never changes; a later edit starts a new version.
 */
export interface CaseReports {
  generate(context: ActingContext, caseId: string): Promise<Written<CaseReport>>;
  report(context: ActingContext, caseId: string): Promise<CaseReport>;
  editDraft(context: ActingContext, caseId: string, version: number, expectedRevision: number, edits: readonly SectionEdit[]): Promise<CaseReportVersion>;
  signOff(context: ActingContext, caseId: string, version: number, expectedRevision: number): Promise<CaseReportVersion>;
  startRevision(context: ActingContext, caseId: string, fromVersion: number): Promise<CaseReportVersion>;
  export(context: ActingContext, caseId: string, version: number): Promise<RenderedDocument>;
}
