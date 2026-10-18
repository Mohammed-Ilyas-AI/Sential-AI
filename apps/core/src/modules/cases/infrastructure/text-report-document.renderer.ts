import type { CaseReportVersion } from '@sentinel/domain';
import type { RenderedDocument, ReportDocumentRenderer } from '../application/ports/report-document-renderer.port.js';

export class TextReportDocumentRenderer implements ReportDocumentRenderer {
  render(
    version: CaseReportVersion,
    heading: { readonly accountLabel: string; readonly institutionLabel: string },
  ): RenderedDocument {
    const lines = [
      'SENTINEL AI — CASE INVESTIGATION REPORT',
      `Institution: ${heading.institutionLabel}`,
      `Account: ${heading.accountLabel}`,
      `Case: ${version.caseId}`,
      `Report version: ${version.version} (${version.status})`,
      `Created: ${version.createdAt} by ${version.createdBy}`,
      `Updated: ${version.updatedAt} by ${version.updatedBy}`,
      ...(version.signedOffAt ? [`Signed off: ${version.signedOffAt} by ${version.signedOffBy ?? 'unknown'}`] : []),
      `Assessment: ${version.basedOn.assessmentId}`,
      `Policy / ruleset: ${version.basedOn.policyVersion} / ${version.basedOn.rulesetVersion}`,
      '',
      ...version.sections.flatMap((section) => [
        section.title.toUpperCase(),
        section.body,
        ...(section.sources.length
          ? ['', 'Sources:', ...section.sources.map((source) => `- ${source.field}: ${source.value}`)]
          : []),
        '',
      ]),
      ...(version.aiSummary.status === 'INCLUDED'
        ? [
            'PRE-EXISTING GROUNDED AI SUMMARY (ADVISORY)',
            version.aiSummary.hypothesis,
            `Confidence: ${version.aiSummary.confidence}; archived ${version.aiSummary.archivedAt}`,
          ]
        : []),
      'This document contains recorded evidence and analyst-authored content. The policy engine, not AI, made the decision.',
    ];
    return {
      contentType: 'text/plain; charset=utf-8',
      fileName: `case-report-v${version.version}.txt`,
      bytes: new TextEncoder().encode(lines.join('\n')),
    };
  }
}
