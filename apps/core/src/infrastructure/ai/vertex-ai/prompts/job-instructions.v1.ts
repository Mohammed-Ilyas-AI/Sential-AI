import type { ModelJob } from '@sentinel/domain';

/**
 * Versioned, fixed task statements, one per job that is wired. The evidence bundle follows as one serialised
 * typed object; nothing from a request is ever spliced into the instruction.
 */
export const JOB_INSTRUCTIONS_V1: Partial<Readonly<Record<ModelJob, string>>> = {
  RISK_EXPLANATION: [
    'Task: explain, for a fraud analyst, why the deterministic engine scored this assessment as it did.',
    'Work only from the evidence bundle below. Do not search for, assume or invent any other record or source.',
    'The score and every contribution are final: restate them exactly, never re-score or re-weight them.',
    'primaryReason: the largest contributions in plain English, using only facts in the evidence bundle.',
    'If the bundle does not support a point, say the evidence is insufficient instead of inferring it.',
    'Keep primaryReason to at most three sentences and under 450 characters.',
    'recommendedAction: the next investigative step for the analyst, under 300 characters. Never suggest releasing a held transfer.',
  ].join('\n'),
  CASE_SUMMARY: [
    'Task: summarise this case for a fraud analyst as a hypothesis grounded in the evidence bundle.',
    'Correlate only what the bundle contains. Do not search for, assume or invent any other record or source.',
    'A candidate, unconfirmed or unobserved relationship is never a confirmed fact: say it is unconfirmed.',
    'Every evidence item must cite, in sourceField, the exact path of the bundle field it came from, for example',
    'assessment.contributions[0].points or drain.drainPct, and quote that field in value.',
    'At most five evidence items. escalate is true only when the evidence supports escalation.',
    'recommendedActions are investigative steps. Never recommend releasing a held transfer.',
  ].join('\n'),
};
