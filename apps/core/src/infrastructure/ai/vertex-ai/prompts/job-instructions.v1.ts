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
  CUSTOMER_OUTREACH: [
    'Task: draft the message the bank sends the account holder about a transfer the bank has paused, as an email and as the script an automated phone call reads aloud.',
    'Work only from the evidence bundle below. State the paused amount and time only if they are in the bundle; never invent a name, number or detail.',
    'Ask the customer to confirm whether they made the transfer by calling the number on the back of their card or opening the bank app themselves.',
    'Never include a link, a phone number, or a request for a password, PIN, OTP or card details. Never say the transfer will be released or approved.',
    'Plain, calm English a customer understands. No internal terms such as score, rule, drain or policy codes. Do not address the customer by name.',
    'Never say why the transfer was paused or mention any device, login, payee, beneficiary or account activity: say only that it was paused to protect them.',
    'Write amounts as S$ with two decimals. Never quote a timestamp or date code; say "today" if the time matters.',
    'subject: under 100 characters. emailBody: under 800 characters. callScript: under 500 characters, written to be spoken.',
  ].join('\n'),
};
