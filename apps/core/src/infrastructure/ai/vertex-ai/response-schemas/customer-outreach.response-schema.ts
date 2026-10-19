import { CUSTOMER_OUTREACH_BODY_MAX_CHARS, CUSTOMER_OUTREACH_SCRIPT_MAX_CHARS, CUSTOMER_OUTREACH_SUBJECT_MAX_CHARS } from '@sentinel/domain';

/** Structured-output schema for the fast-tier customer outreach: an email and an automated call script. */
export const CUSTOMER_OUTREACH_RESPONSE_SCHEMA = {
  type: 'object',
  required: ['subject', 'emailBody', 'callScript'],
  properties: {
    subject: { type: 'string', maxLength: CUSTOMER_OUTREACH_SUBJECT_MAX_CHARS },
    emailBody: { type: 'string', maxLength: CUSTOMER_OUTREACH_BODY_MAX_CHARS },
    callScript: { type: 'string', maxLength: CUSTOMER_OUTREACH_SCRIPT_MAX_CHARS },
  },
} as const;
