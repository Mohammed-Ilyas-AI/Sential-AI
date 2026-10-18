import type { CaseReportVersion } from '@sentinel/domain';

export interface RenderedDocument {
  readonly contentType: string;
  readonly fileName: string;
  readonly bytes: Uint8Array;
}

/** Renders a saved report version as a downloadable document. The content is the stored text, nothing else. */
export interface ReportDocumentRenderer {
  render(version: CaseReportVersion, heading: { readonly accountLabel: string; readonly institutionLabel: string }): RenderedDocument;
}
