import type { CaseReportSectionId } from '@sentinel/domain';
import type { IconName } from '../../../../shared/ui/icon/icon-paths';

/** One piece of a report line: plain text, or a fact worth catching the eye (a decision, a band, an amount). */
export interface ReportFragment {
  readonly text: string;
  readonly tone: 'plain' | 'held' | 'allowed' | 'critical' | 'amount' | 'reference';
}

/** A report body read for display: lines that start with a UTC time become timeline entries, the rest paragraphs. */
export type ReportBlock =
  | { readonly kind: 'moment'; readonly time: string; readonly fragments: readonly ReportFragment[] }
  | { readonly kind: 'line'; readonly bullet: boolean; readonly fragments: readonly ReportFragment[] };

const MOMENT = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) UTC\s+(.*)$/;
const FACT = /(SG-RD-50_THRESHOLD_EXCEEDED|HELD|HOLD|KILL_SWITCH|REJECTED|ALLOWED|ALLOW|CRITICAL|S\$[\d,]+(?:\.\d{2})?|ACC-\d{5}|\d+(?:\.\d)?%)/g;

function toneOf(fact: string): ReportFragment['tone'] {
  if (fact.startsWith('S$')) return 'amount';
  if (fact.startsWith('ACC-')) return 'reference';
  if (fact.endsWith('%')) return 'amount';
  if (fact === 'ALLOW' || fact === 'ALLOWED') return 'allowed';
  if (fact === 'CRITICAL' || fact.endsWith('THRESHOLD_EXCEEDED')) return 'critical';
  return 'held';
}

export function fragmentsOf(text: string): readonly ReportFragment[] {
  const fragments: ReportFragment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(FACT)) {
    const at = match.index ?? 0;
    if (at > cursor) fragments.push({ text: text.slice(cursor, at), tone: 'plain' });
    fragments.push({ text: match[0], tone: toneOf(match[0]) });
    cursor = at + match[0].length;
  }
  if (cursor < text.length) fragments.push({ text: text.slice(cursor), tone: 'plain' });
  return fragments;
}

export function readReport(body: string): readonly ReportBlock[] {
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line): ReportBlock => {
      const moment = MOMENT.exec(line);
      if (moment) return { kind: 'moment', time: `${moment[2]}`, fragments: fragmentsOf(moment[3] ?? '') };
      const bullet = /^[-•*]\s+/.test(line);
      return { kind: 'line', bullet, fragments: fragmentsOf(bullet ? line.replace(/^[-•*]\s+/, '') : line) };
    });
}

/** How each section is marked on the page. */
export const SECTION_LOOK: Readonly<Record<CaseReportSectionId, { readonly icon: IconName; readonly tone: string }>> = {
  SUMMARY: { icon: 'explain', tone: 'accent' },
  TIMELINE: { icon: 'clock', tone: 'info' },
  EVIDENCE: { icon: 'analytics', tone: 'critical' },
  INTERVENTIONS: { icon: 'intervention', tone: 'warning' },
  NETWORK: { icon: 'network', tone: 'purple' },
  RECOMMENDATION: { icon: 'check', tone: 'success' },
};
