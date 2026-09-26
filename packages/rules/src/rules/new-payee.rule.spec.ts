import { describe, expect, it } from 'vitest';
import { newPayeeRule } from './new-payee.rule.js';

describe('NEW_PAYEE rule', () => {
  it('declares its code and the documented maximum of 16 points', () => {
    expect(newPayeeRule.code).toBe('NEW_PAYEE');
    expect(newPayeeRule.maxPoints).toBe(16);
  });

  it.todo('scores 16 for a payee added under 24 hours ago');
  it.todo('scores 8 for a payee added between 24 hours and 7 days ago');
  it.todo('scores nothing for a payee added 7 days ago or earlier');
});
