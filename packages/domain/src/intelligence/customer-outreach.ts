import type { AdvisoryOutcome } from './advisory-outcome.js';

export const CUSTOMER_OUTREACH_SUBJECT_MAX_CHARS = 120;
export const CUSTOMER_OUTREACH_BODY_MAX_CHARS = 900;
export const CUSTOMER_OUTREACH_SCRIPT_MAX_CHARS = 600;

/**
 * The message the bank's systems send the account holder about a held transfer: an email and the script an
 * automated call reads. It asks the customer to verify with the bank; it never asks for a password, PIN or OTP,
 * carries no link, and never says the transfer will be released.
 */
export interface CustomerOutreachDraft {
  readonly subject: string;
  readonly emailBody: string;
  readonly callScript: string;
}

/**
 * GEMINI when the fast tier drafted it and it passed the schema and content checks; TEMPLATE when sentinel-core
 * wrote it from fixed wording because Gemini was unavailable. Either way the outreach goes out: the model is
 * never on the protection's critical path.
 */
export interface CustomerOutreachProposal {
  readonly source: 'GEMINI' | 'TEMPLATE';
  readonly draft: CustomerOutreachDraft;
  /** Gemini's outcome; absent when the fixed wording was asked for directly (`?draft=template`). */
  readonly model?: AdvisoryOutcome<CustomerOutreachDraft>;
}
