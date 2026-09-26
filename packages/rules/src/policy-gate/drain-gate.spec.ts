import { describe, it } from 'vitest';

describe('drainGate() — SG-RD-50', () => {
  it.todo('excludes STANDING and GIRO transactions entirely');
  it.todo('excludes BILL payments to a designated billing organisation, but not to any other payee');
  it.todo('does not protect an account whose balance at window start is below 5_000_000');
  it.todo('protects an account at exactly 5_000_000');
  it.todo('includes the evaluated amount in outflow24h');
  it.todo('does not meet the threshold at exactly 50%');
  it.todo('meets the threshold one cent above 50%');
});
