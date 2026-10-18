import { describe, expect, it } from 'vitest';
import { isOwnTenant, maskedReference, parseTenantLens } from './field-visibility.js';

describe('tenant lens field visibility (T§14)', () => {
  it('shows only the last four alphanumerics of another tenant’s reference', () => {
    expect(maskedReference('ACC-55902')).toBe('••••5902');
    expect(maskedReference('acct_9f3c2a71')).toBe('••••2a71');
  });

  it('treats the operator view and the record’s own institution as own tenant; unknown institutions are not', () => {
    expect(isOwnTenant(null, 'BANK_B')).toBe(true);
    expect(isOwnTenant('BANK_A', 'BANK_A')).toBe(true);
    expect(isOwnTenant('BANK_A', 'BANK_B')).toBe(false);
    expect(isOwnTenant('BANK_A', undefined)).toBe(false);
  });

  it('accepts only the simulated institutions as a lens', () => {
    expect(parseTenantLens(undefined)).toBeNull();
    expect(parseTenantLens('bank_b')).toBe('BANK_B');
    expect(parseTenantLens('BANK_Z')).toBe('INVALID');
  });
});
