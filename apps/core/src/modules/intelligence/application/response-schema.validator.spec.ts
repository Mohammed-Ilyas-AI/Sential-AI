import { describe, expect, it } from 'vitest';
import { ResponseSchemaValidator } from './response-schema.validator.js';

const validator = new ResponseSchemaValidator();
const draft = (emailBody: string) => JSON.stringify({ subject: 'We paused a transfer', emailBody, callScript: 'This is your bank.' });

describe('ResponseSchemaValidator.customerOutreach', () => {
  it('accepts a calm message that reassures about secrets', () => {
    for (const body of [
      'We paused a transfer of S$11,500.00. Please call the number on the back of your card. We will never ask for your PIN or one-time code.',
      'Please do not share your password with anyone, including us.',
      'We paused a transfer of S$11,500 initiated on 2026-10-19T07:46:30.296Z. Please call the number on the back of your card.',
    ]) {
      expect(validator.customerOutreach(draft(body))).not.toBeNull();
    }
  });

  it('rejects links, phone numbers, requests for secrets and promises of release', () => {
    for (const body of [
      'Verify here: https://example.test/login',
      'Call us on +65 6123 4567 now.',
      'Reply with your OTP to confirm.',
      'Please enter your card number so we can check.',
      'Your transfer will be released shortly.',
    ]) {
      expect(validator.customerOutreach(draft(body))).toBeNull();
    }
  });
});
