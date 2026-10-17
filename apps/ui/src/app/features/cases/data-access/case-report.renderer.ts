import type { CaseSummary, DecisionRecord } from '@sentinel/domain';
import type { AccountEvent } from '../../../state/account-focus/account-focus.selectors';
import type { CaseListItem, CaseSignOff } from '../models/case-list-item';

export interface CaseReportInput {
  readonly item: CaseListItem;
  readonly decision: DecisionRecord | null;
  readonly timeline: readonly AccountEvent[];
  readonly summary: CaseSummary | null;
  readonly signOff: CaseSignOff | null;
  readonly generatedAt: string;
}

const escape = (value: string): string =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const money = (minor: number): string => `S$${(minor / 100).toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** A standalone, printable HTML case report: recorded facts first, the AI summary labelled as advisory, then the sign-off. */
export function renderCaseReport({ item, decision, timeline, summary, signOff, generatedAt }: CaseReportInput): string {
  const facts = decision
    ? `<tr><th>Decision</th><td>${escape(decision.decision)} · ${escape(decision.reasonCodes.join(', '))}</td></tr>
       <tr><th>Amount</th><td>${money(decision.amount)}</td></tr>
       <tr><th>Drain</th><td>${decision.assessment.drain.drainPct.toFixed(1)}% of ${money(decision.assessment.drain.balanceAtWindowStart)} in 24h</td></tr>
       <tr><th>Advisory score</th><td>${decision.riskScore} ${escape(decision.band)}</td></tr>
       <tr><th>Policy</th><td>${escape(decision.policyVersion)} · ruleset ${escape(decision.rulesetVersion)}</td></tr>
       <tr><th>Trace</th><td>${escape(decision.traceId)}</td></tr>`
    : '';
  const contributions = decision?.assessment.contributions.map((c) => `<li>${escape(c.label)}: +${c.points}</li>`).join('') ?? '';
  const events = timeline
    .slice(0, 20)
    .map((event) =>
      event.kind === 'DECISION'
        ? `<li>${escape(event.at)} — ${escape(event.row.decision)} ${money(event.row.amount)}, score ${event.row.score}</li>`
        : `<li>${escape(event.at)} — ${escape(event.intervention.previousState)} → ${escape(event.intervention.state)} by ${escape(event.intervention.actor)}</li>`,
    )
    .join('');
  const advisory = summary
    ? `<h2>Gemini advisory summary <small>(advisory; schema-validated and grounded in the evidence bundle)</small></h2>
       <p>${escape(summary.hypothesis)}</p><p>Confidence ${escape(summary.confidence)}${summary.escalate ? ' · escalation suggested' : ''}</p>
       <ol>${summary.evidence.map((e) => `<li>${escape(e.claim)} <code>${escape(e.sourceField)} = ${escape(e.value)}</code></li>`).join('')}</ol>
       <ul>${summary.recommendedActions.map((a) => `<li>${escape(a)}</li>`).join('')}</ul>`
    : '<h2>Gemini advisory summary</h2><p>Not requested, or Gemini was unavailable. The deterministic record above is the explanation of record.</p>';
  const attestation = signOff
    ? `<p><b>Signed by ${escape(signOff.analystIdentity)}</b> at ${escape(signOff.signedAt)} · disposition ${escape(signOff.disposition)}</p>${signOff.note ? `<p>${escape(signOff.note)}</p>` : ''}`
    : '<p><b>Not signed.</b> This draft is not an analyst determination.</p>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escape(item.caseId)} · SENTINEL AI case report</title>
<style>body{font:14px/1.5 system-ui,sans-serif;max-width:760px;margin:32px auto;color:#111}h1{margin:0}h2{margin-top:28px;font-size:16px}
table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #ddd;padding:6px;text-align:left;vertical-align:top}th{width:160px;color:#555;font-weight:500}
code{font-size:12px;color:#1d4ed8}small{color:#666;font-weight:400}.note{color:#666;font-size:12px}</style></head><body>
<h1>Case report ${escape(item.caseId)}</h1>
<p class="note">SENTINEL AI · generated ${escape(generatedAt)} · synthetic data only. Rules decide. AI explains. Humans authorize.</p>
<h2>Recorded facts</h2><table><tr><th>Account</th><td>${escape(item.reference)}</td></tr>${facts}</table>
<h2>Risk contributions</h2><ul>${contributions}</ul>
<h2>Timeline</h2><ul>${events}</ul>
${advisory}
<h2>Analyst sign-off</h2>${attestation}
</body></html>`;
}
