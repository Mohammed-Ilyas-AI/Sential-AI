import type { AuditEvent, CaseReportVersion, CaseSummary, CustomerContactRecord, KillSwitchRecord, ScenarioRun } from '@sentinel/domain';
import type { CollectionDefinition, MongoDocument } from './collection-definition.js';

/** Append-only analyst and system actions outside the intervention log. Never updated, never deleted. */
export type AuditEventDocument = MongoDocument<AuditEvent>;

export const auditEventsCollection: CollectionDefinition = {
  name: 'audit_events',
  indexes: [
    { key: { occurredAt: -1 }, name: 'occurredAt' },
    { key: { 'subject.institutionId': 1, occurredAt: -1 }, name: 'institution_occurredAt' },
    { key: { 'subject.caseId': 1, occurredAt: -1 }, name: 'case_occurredAt' },
  ],
};

/** Append-only kill-switch history per account; the latest record is the account's state. */
export type AccountControlDocument = MongoDocument<KillSwitchRecord & { readonly ordinal: number }>;

export const accountControlsCollection: CollectionDefinition = {
  name: 'account_controls',
  indexes: [
    { key: { accountId: 1, ordinal: 1 }, name: 'accountId_ordinal', unique: true },
    { key: { idempotencyKey: 1 }, name: 'idempotencyKey', unique: true },
  ],
};

/** Append-only record of customer contact attempts (simulated channel). */
export type CustomerContactDocument = MongoDocument<CustomerContactRecord>;

export const customerContactsCollection: CollectionDefinition = {
  name: 'customer_contacts',
  indexes: [
    { key: { accountId: 1, recordedAt: -1 }, name: 'accountId_recordedAt' },
    { key: { idempotencyKey: 1 }, name: 'idempotencyKey', unique: true },
  ],
};

/** One document per report version. A signed-off version is never written again. */
export type CaseReportDocument = MongoDocument<CaseReportVersion>;

export const caseReportsCollection: CollectionDefinition = {
  name: 'case_reports',
  indexes: [{ key: { caseId: 1, version: -1 }, name: 'caseId_version', unique: true }],
};

export type CaseSummaryArchiveDocument = MongoDocument<{
  readonly assessmentId: string;
  readonly summary: CaseSummary;
  readonly archivedAt: string;
}>;

export const caseSummariesCollection: CollectionDefinition = {
  name: 'case_summaries',
  indexes: [{ key: { assessmentId: 1 }, name: 'assessmentId', unique: true }],
};

export type ScenarioRunDocument = MongoDocument<ScenarioRun>;

export const scenarioRunsCollection: CollectionDefinition = {
  name: 'scenario_runs',
  indexes: [
    { key: { idempotencyKey: 1 }, name: 'idempotencyKey', unique: true },
    { key: { status: 1, requestedAt: -1 }, name: 'status_requestedAt' },
  ],
};
