import type { CaseReportVersion } from '@sentinel/domain';
import type { RenderedDocument, ReportDocumentRenderer } from '../../modules/cases/application/ports/report-document-renderer.port.js';

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 50;
const BODY_SIZE = 9.5;
const LINE_HEIGHT = 13;
/** Helvetica averages about half an em per character; wrapping by count keeps the writer dependency-free. */
const CHARS_PER_LINE = Math.floor((PAGE_WIDTH - 2 * MARGIN) / (BODY_SIZE * 0.5));
const LINES_PER_PAGE = Math.floor((PAGE_HEIGHT - 2 * MARGIN) / LINE_HEIGHT);

interface Line {
  readonly text: string;
  readonly bold?: boolean;
}

/** The standard fonts speak WinAnsi; anything outside it is written as its closest ASCII form. */
function toWinAnsi(text: string): string {
  return text
    .replaceAll('•', '*')
    .replaceAll('→', '->')
    .replaceAll(/[—–]/g, '-')
    .replaceAll(/[‘’]/g, "'")
    .replaceAll(/[“”]/g, '"')
    .replaceAll('…', '...')
    .replaceAll(/[^\x20-\x7E]/g, '?');
}

const escape = (text: string): string => text.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');

function wrap(text: string): string[] {
  const words = toWinAnsi(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    for (let start = 0; start < word.length; start += CHARS_PER_LINE) {
      const piece = word.slice(start, start + CHARS_PER_LINE);
      if (current === '') current = piece;
      else if (current.length + 1 + piece.length <= CHARS_PER_LINE) current = `${current} ${piece}`;
      else {
        lines.push(current);
        current = piece;
      }
    }
  }
  return current === '' ? [''] : [...lines, current];
}

/**
 * The saved report version as a PDF: the stored section text and sources, the version, its status, who edited and
 * who signed off. A draft is marked as not signed off on every page. No screenshot, nothing re-generated.
 */
export class PdfReportRenderer implements ReportDocumentRenderer {
  render(version: CaseReportVersion, heading: { readonly accountLabel: string; readonly institutionLabel: string }): RenderedDocument {
    const lines: Line[] = [
      { text: 'SENTINEL AI - Case report', bold: true },
      { text: `${heading.institutionLabel} - account ${heading.accountLabel} - case ${version.caseId}` },
      { text: `Version ${version.version} (${version.status === 'SIGNED_OFF' ? 'signed off' : 'DRAFT, not signed off'}), revision ${version.revision}` },
      { text: `Generated ${version.createdAt} by ${version.createdBy}; last updated ${version.updatedAt} by ${version.updatedBy}` },
      ...(version.signedOffAt ? [{ text: `Signed off ${version.signedOffAt} by ${version.signedOffBy ?? ''}` }] : []),
      ...(version.supersedesVersion ? [{ text: `Supersedes signed-off version ${version.supersedesVersion}` }] : []),
      { text: `Assessment ${version.basedOn.assessmentId}; policy ${version.basedOn.policyVersion}; ruleset ${version.basedOn.rulesetVersion}` },
      { text: 'Synthetic data. The decision was made by the deterministic policy engine; AI content, where present, is advisory.' },
      { text: '' },
    ];
    for (const section of version.sections) {
      lines.push({ text: `${section.title}${section.edited ? ' (edited by analyst)' : ''}`, bold: true });
      for (const paragraph of section.body.split('\n')) lines.push(...wrap(paragraph).map((text) => ({ text })));
      if (section.sources.length) {
        lines.push({ text: 'Sources:' });
        for (const source of section.sources) lines.push(...wrap(`- ${source.field}: ${source.value}`).map((text) => ({ text })));
      }
      lines.push({ text: '' });
    }

    const pages: Line[][] = [];
    for (let start = 0; start < lines.length; start += LINES_PER_PAGE) pages.push(lines.slice(start, start + LINES_PER_PAGE));
    const footer = version.status === 'SIGNED_OFF' ? `Signed off version ${version.version}` : `DRAFT version ${version.version} - not signed off`;

    // Objects: 1 catalog, 2 pages, 3 regular font, 4 bold font, then a page and its content stream per page.
    const objects: string[] = [];
    const pageIds = pages.map((_, index) => 5 + index * 2);
    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
    objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    pages.forEach((page, index) => {
      const pageId = pageIds[index] ?? 0;
      const operations = page.map(
        (line, row) => `BT /${line.bold ? 'F2' : 'F1'} ${line.bold ? 11 : BODY_SIZE} Tf ${MARGIN} ${PAGE_HEIGHT - MARGIN - row * LINE_HEIGHT} Td (${escape(toWinAnsi(line.text))}) Tj ET`,
      );
      operations.push(`BT /F1 8 Tf ${MARGIN} 28 Td (${escape(`${footer} - page ${index + 1} of ${pages.length}`)}) Tj ET`);
      const stream = operations.join('\n');
      objects[pageId] =
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageId + 1} 0 R >>`;
      objects[pageId + 1] = `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`;
    });

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [];
    for (let id = 1; id < objects.length; id += 1) {
      offsets[id] = Buffer.byteLength(pdf, 'latin1');
      pdf += `${id} 0 obj\n${objects[id] ?? ''}\nendobj\n`;
    }
    const xref = Buffer.byteLength(pdf, 'latin1');
    pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let id = 1; id < objects.length; id += 1) pdf += `${String(offsets[id] ?? 0).padStart(10, '0')} 00000 n \n`;
    pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

    return {
      contentType: 'application/pdf',
      fileName: `case-${version.caseId}-report-v${version.version}${version.status === 'DRAFT' ? '-draft' : ''}.pdf`,
      bytes: new Uint8Array(Buffer.from(pdf, 'latin1')),
    };
  }
}
