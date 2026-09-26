import { DECISION_REASON } from '@sentinel/domain';
import { describe, expect, it } from 'vitest';
import { decisionRecord, demoFinalDecision } from '../../../../testing/ui-fixtures';
import { toAccountRiskView } from './account-risk-view';

describe('toAccountRiskView', () => {
  it('reads the demo hold exactly as the gate wrote it', () => {
    const view = toAccountRiskView(demoFinalDecision());
    expect(view).toMatchObject({
      accountReference: 'ACC-10291',
      balanceAtWindowStart: 5_200_000,
      transferredLast24h: 3_400_000,
      protectedAccount: true,
      thresholdMet: true,
      score: 95,
      band: 'CRITICAL',
      signals: {
        newDevice: true,
        newPayee: true,
        velocityAnomaly: true,
        coolingOffActive: false,
        destinationPreviouslyFlagged: true,
      },
    });
    expect(view.drainPct.toFixed(1)).toBe('65.4');
  });

  it('marks an account below the protected balance as unprotected', () => {
    const view = toAccountRiskView(decisionRecord({ transactionId: 'txn_small', reasonCodes: [DECISION_REASON.notProtected] }));
    expect(view.protectedAccount).toBe(false);
  });
});
