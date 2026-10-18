import type { Case, CaseReport, CaseReportSection, CaseReportVersion } from '@sentinel/domain';
import { ApplicationError } from '../../../platform/errors/application-error.js';
import type { IdGenerator } from '../../../platform/ids/id-generator.js';
import type { Clock } from '../../../platform/time/clock.js';
import type { AlertRepository } from '../../alerts/application/ports/alert-repository.port.js';
import type { ActingContext, AuditTrail } from '../../audit/application/audit-trail.js';
import type { DecisionRepository } from '../../decision/application/ports/decision-repository.port.js';
import type { AccountControlRepository } from '../../interventions/application/ports/account-control-repository.port.js';
import type { InterventionRepository } from '../../interventions/application/ports/intervention-repository.port.js';
import type { CompileEvidenceBundle } from '../../investigations/application/compile-evidence-bundle.use-case.js';
import type { CaseSummaryArchive } from '../../investigations/application/ports/case-summary-archive.port.js';
import type { TenantAccessService } from '../../tenant-access/application/tenant-access.service.js';
import { ANALYST_RECOMMENDATION_PLACEHOLDER, composeCaseReport } from './case-report.composer.js';
import type { CaseReports, ManageCase, SectionEdit, Written } from './manage-case.use-case.js';
import type { CaseReportRepository } from './ports/case-report-repository.port.js';
import type { CaseRepository } from './ports/case-repository.port.js';
import type { RenderedDocument, ReportDocumentRenderer } from './ports/report-document-renderer.port.js';

export const REPORT_SECTION_MAX_CHARS = 8_000;

export interface CaseServiceDependencies {
  readonly cases: CaseRepository;
  readonly reports: CaseReportRepository;
  readonly bundles: CompileEvidenceBundle;
  readonly alerts: AlertRepository;
  readonly decisions: DecisionRepository;
  readonly interventions: InterventionRepository;
  readonly accountControls: AccountControlRepository;
  readonly summaries: CaseSummaryArchive;
  readonly renderer: ReportDocumentRenderer;
  readonly access: TenantAccessService;
  readonly audit: AuditTrail;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

const versionSummary = (version: CaseReportVersion) => ({
  version: version.version,
  status: version.status,
  updatedAt: version.updatedAt,
  updatedBy: version.updatedBy,
  ...(version.signedOffAt ? { signedOffAt: version.signedOffAt } : {}),
  ...(version.signedOffBy ? { signedOffBy: version.signedOffBy } : {}),
});

/**
 * Cases and their reports. Every read and write is tenant-checked against the case's institution; every write is
 * audited with identifiers only. No model is called here: the report cites an AI summary only if one was archived.
 */
export class CaseService implements ManageCase, CaseReports {
  constructor(private readonly deps: CaseServiceDependencies) {}

  async openFromAlert(context: ActingContext, alertId: string): Promise<Written<Case>> {
    const analyst = this.analystOf(context);
    const alert = await this.deps.alerts.findById(alertId);
    if (!alert) throw new ApplicationError('NOT_FOUND', `No alert ${alertId}`);
    const owner = await this.deps.access.authoriseAccount(context, alert.accountId, 'case', { transactionId: alert.transactionId });

    let evidence;
    try {
      evidence = await this.deps.bundles.compile(alert.assessmentId);
    } catch (error) {
      if (error instanceof ApplicationError && error.kind === 'NOT_FOUND') {
        throw new ApplicationError('UNPROCESSABLE', `The evidence for alert ${alertId} is missing; no case was opened`);
      }
      throw error;
    }
    const now = this.deps.clock.now().toISOString();
    const opened: Case = {
      id: this.deps.ids.next(),
      accountId: alert.accountId,
      ...(owner.displayReference ? { accountReference: owner.displayReference } : {}),
      institutionId: owner.institutionId,
      assessmentId: alert.assessmentId,
      alertIds: [alert.id],
      evidence,
      evidenceCompiledAt: now,
      openedAt: now,
      openedBy: analyst,
      updatedAt: now,
      status: 'OPEN',
    };
    const written = await this.deps.cases.open(opened);
    if (written.outcome === 'CREATED') {
      await this.deps.audit.record(context, {
        category: 'CASE',
        action: 'CASE_OPENED',
        outcome: 'SUCCEEDED',
        subject: { institutionId: owner.institutionId, accountId: alert.accountId, caseId: written.record.id, transactionId: alert.transactionId },
      });
    }
    return written;
  }

  async escalate(context: ActingContext, caseId: string): Promise<Case> {
    const analyst = this.analystOf(context);
    const existing = await this.authorisedCase(context, caseId);
    const escalated = await this.deps.cases.changeStatus(caseId, 'OPEN', 'ESCALATED', { at: this.deps.clock.now().toISOString(), by: analyst });
    if (!escalated) throw new ApplicationError('CONFLICT', `Case ${caseId} is ${existing.status}; only an OPEN case can be escalated`);
    await this.deps.audit.record(context, {
      category: 'CASE',
      action: 'CASE_ESCALATED',
      outcome: 'SUCCEEDED',
      subject: { institutionId: existing.institutionId, accountId: existing.accountId, caseId },
    });
    return escalated;
  }

  get(context: ActingContext, caseId: string): Promise<Case> {
    return this.authorisedCase(context, caseId);
  }

  list(context: ActingContext, limit: number): Promise<readonly Case[]> {
    return this.deps.cases.list(limit, context.lens ?? undefined);
  }

  /** One deliberate action. A second request returns the existing report rather than generating another. */
  async generate(context: ActingContext, caseId: string): Promise<Written<CaseReport>> {
    const analyst = this.analystOf(context);
    const investigationCase = await this.authorisedCase(context, caseId);
    const existing = await this.deps.reports.versions(caseId);
    if (existing.length > 0) return { outcome: 'DUPLICATE', record: this.reportOf(caseId, existing) };

    const alertTransaction = investigationCase.evidence.assessment.transactionId;
    const [interventions, contacts, killSwitches, decision, archivedSummary] = await Promise.all([
      this.deps.interventions.findByAccountId(investigationCase.accountId),
      this.deps.accountControls.contacts(investigationCase.accountId),
      this.deps.accountControls.killSwitchHistory(investigationCase.accountId),
      this.deps.decisions.findByTransactionId(alertTransaction),
      this.deps.summaries.find(investigationCase.assessmentId),
    ]);
    const { sections, aiSummary } = composeCaseReport({ investigationCase, interventions, contacts, killSwitches, decision, archivedSummary });
    const now = this.deps.clock.now().toISOString();
    const first: CaseReportVersion = {
      reportId: this.deps.ids.next(),
      caseId,
      version: 1,
      revision: 1,
      status: 'DRAFT',
      sections,
      basedOn: {
        accountId: investigationCase.accountId,
        assessmentId: investigationCase.assessmentId,
        alertIds: investigationCase.alertIds,
        policyVersion: decision?.policyVersion ?? interventions[0]?.policyVersion ?? 'not recorded',
        rulesetVersion: decision?.rulesetVersion ?? interventions[0]?.rulesetVersion ?? 'not recorded',
        evidenceCompiledAt: investigationCase.evidenceCompiledAt,
      },
      aiSummary,
      createdAt: now,
      createdBy: analyst,
      updatedAt: now,
      updatedBy: analyst,
    };
    try {
      await this.deps.reports.insertVersion(first);
    } catch (error) {
      if (!(error instanceof ApplicationError && error.kind === 'CONFLICT')) throw error;
      return { outcome: 'DUPLICATE', record: this.reportOf(caseId, await this.deps.reports.versions(caseId)) };
    }
    await this.audited(context, investigationCase, 'REPORT_GENERATED', first);
    return { outcome: 'CREATED', record: this.reportOf(caseId, [first]) };
  }

  async report(context: ActingContext, caseId: string): Promise<CaseReport> {
    await this.authorisedCase(context, caseId);
    const versions = await this.deps.reports.versions(caseId);
    if (versions.length === 0) throw new ApplicationError('NOT_FOUND', `Case ${caseId} has no report yet`);
    return this.reportOf(caseId, versions);
  }

  async editDraft(context: ActingContext, caseId: string, version: number, expectedRevision: number, edits: readonly SectionEdit[]): Promise<CaseReportVersion> {
    const analyst = this.analystOf(context);
    const investigationCase = await this.authorisedCase(context, caseId);
    const draft = await this.draftOf(caseId, version, expectedRevision);
    const known = new Set(draft.sections.map((candidate) => candidate.id));
    for (const edit of edits) {
      if (!known.has(edit.id)) throw new ApplicationError('UNPROCESSABLE', `Unknown report section ${edit.id}`);
      if (edit.body.trim() === '' || edit.body.length > REPORT_SECTION_MAX_CHARS) {
        throw new ApplicationError('UNPROCESSABLE', `Section ${edit.id} must hold 1 to ${REPORT_SECTION_MAX_CHARS} characters`);
      }
    }
    const byId = new Map(edits.map((edit) => [edit.id, edit.body]));
    const sections = draft.sections.map((candidate): CaseReportSection => {
      const body = byId.get(candidate.id);
      return body === undefined || body === candidate.body ? candidate : { ...candidate, body, edited: true };
    });
    const next: CaseReportVersion = { ...draft, sections, revision: draft.revision + 1, updatedAt: this.deps.clock.now().toISOString(), updatedBy: analyst };
    if (!(await this.deps.reports.replaceDraft(next, expectedRevision))) {
      throw new ApplicationError('CONFLICT', `Version ${version} changed or was signed off meanwhile; reload it`);
    }
    await this.audited(context, investigationCase, 'REPORT_EDITED', next, `sections: ${[...byId.keys()].join(', ') || 'none'}`);
    return next;
  }

  async signOff(context: ActingContext, caseId: string, version: number, expectedRevision: number): Promise<CaseReportVersion> {
    const analyst = this.analystOf(context);
    const investigationCase = await this.authorisedCase(context, caseId);
    const draft = await this.draftOf(caseId, version, expectedRevision);
    const recommendation = draft.sections.find((candidate) => candidate.id === 'RECOMMENDATION');
    if (!recommendation || recommendation.body.includes(ANALYST_RECOMMENDATION_PLACEHOLDER)) {
      throw new ApplicationError('UNPROCESSABLE', 'Write the analyst recommendation before signing off');
    }
    if (draft.sections.some((candidate) => candidate.body.trim() === '')) {
      throw new ApplicationError('UNPROCESSABLE', 'Every section needs content before sign-off');
    }
    const now = this.deps.clock.now().toISOString();
    const signed: CaseReportVersion = {
      ...draft,
      status: 'SIGNED_OFF',
      revision: draft.revision + 1,
      updatedAt: now,
      updatedBy: analyst,
      signedOffAt: now,
      signedOffBy: analyst,
    };
    if (!(await this.deps.reports.replaceDraft(signed, expectedRevision))) {
      throw new ApplicationError('CONFLICT', `Version ${version} changed or was signed off meanwhile; reload it`);
    }
    await this.audited(context, investigationCase, 'REPORT_SIGNED_OFF', signed);
    return signed;
  }

  /** Editing after sign-off starts a new draft version; the signed version is never touched. */
  async startRevision(context: ActingContext, caseId: string, fromVersion: number): Promise<CaseReportVersion> {
    const analyst = this.analystOf(context);
    const investigationCase = await this.authorisedCase(context, caseId);
    const versions = await this.deps.reports.versions(caseId);
    const latest = versions.at(-1);
    if (!latest) throw new ApplicationError('NOT_FOUND', `Case ${caseId} has no report yet`);
    if (latest.version !== fromVersion || latest.status !== 'SIGNED_OFF') {
      throw new ApplicationError('CONFLICT', `Only the latest signed-off version can be revised; the latest is version ${latest.version} (${latest.status})`);
    }
    const now = this.deps.clock.now().toISOString();
    const { signedOffAt: _signedAt, signedOffBy: _signedBy, ...base } = latest;
    const draft: CaseReportVersion = {
      ...base,
      version: latest.version + 1,
      revision: 1,
      status: 'DRAFT',
      sections: latest.sections.map((candidate) => ({ ...candidate, edited: false })),
      createdAt: now,
      createdBy: analyst,
      updatedAt: now,
      updatedBy: analyst,
      supersedesVersion: latest.version,
    };
    try {
      await this.deps.reports.insertVersion(draft);
    } catch (error) {
      if (error instanceof ApplicationError && error.kind === 'CONFLICT') {
        throw new ApplicationError('CONFLICT', `Version ${draft.version} was started meanwhile; reload the report`);
      }
      throw error;
    }
    await this.audited(context, investigationCase, 'REPORT_REVISION_STARTED', draft, `supersedes version ${latest.version}`);
    return draft;
  }

  async export(context: ActingContext, caseId: string, version: number): Promise<RenderedDocument> {
    const investigationCase = await this.authorisedCase(context, caseId);
    const stored = (await this.deps.reports.versions(caseId)).find((candidate) => candidate.version === version);
    if (!stored) throw new ApplicationError('NOT_FOUND', `Case ${caseId} has no report version ${version}`);
    const document = this.deps.renderer.render(stored, {
      accountLabel: investigationCase.accountReference ?? investigationCase.accountId,
      institutionLabel: investigationCase.institutionId.replace(/^BANK_/, 'Bank '),
    });
    await this.audited(context, investigationCase, 'REPORT_EXPORTED', stored, document.contentType);
    return document;
  }

  private analystOf(context: ActingContext): string {
    if (context.actor !== 'ANALYST' || !context.actorIdentity?.trim()) {
      throw new ApplicationError('UNPROCESSABLE', 'An analyst identity is required');
    }
    return context.actorIdentity;
  }

  private async authorisedCase(context: ActingContext, caseId: string): Promise<Case> {
    const found = await this.deps.cases.findById(caseId);
    if (!found) throw new ApplicationError('NOT_FOUND', `No case ${caseId}`);
    await this.deps.access.authoriseInstitution(context, found.institutionId, 'case', { accountId: found.accountId, caseId });
    return found;
  }

  private async draftOf(caseId: string, version: number, expectedRevision: number): Promise<CaseReportVersion> {
    const stored = (await this.deps.reports.versions(caseId)).find((candidate) => candidate.version === version);
    if (!stored) throw new ApplicationError('NOT_FOUND', `Case ${caseId} has no report version ${version}`);
    if (stored.status !== 'DRAFT') throw new ApplicationError('CONFLICT', `Version ${version} is signed off and cannot change; start a revision`);
    if (stored.revision !== expectedRevision) throw new ApplicationError('CONFLICT', `Version ${version} changed meanwhile (revision ${stored.revision}); reload it`);
    return stored;
  }

  private reportOf(caseId: string, versions: readonly CaseReportVersion[]): CaseReport {
    const latest = versions.at(-1);
    if (!latest) throw new ApplicationError('NOT_FOUND', `Case ${caseId} has no report yet`);
    return { caseId, latest, versions: versions.map(versionSummary) };
  }

  private async audited(context: ActingContext, investigationCase: Case, action: string, version: CaseReportVersion, detail?: string): Promise<void> {
    await this.deps.audit.record(context, {
      category: 'CASE_REPORT',
      action,
      outcome: 'SUCCEEDED',
      subject: {
        institutionId: investigationCase.institutionId,
        accountId: investigationCase.accountId,
        caseId: investigationCase.id,
        reportId: version.reportId,
        reportVersion: version.version,
      },
      ...(detail ? { detail } : {}),
    });
  }
}
