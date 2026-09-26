import type { AccountSecurityEvent, RecordedRiskAssessment } from '@sentinel/domain';
import { describe, expect, it } from 'vitest';
import type { AlertRepository } from '../../src/modules/alerts/application/ports/alert-repository.port.js';
import type { AssessmentRepository } from '../../src/modules/risk/application/ports/assessment-repository.port.js';
import type { SecurityEventLog } from '../../src/modules/security-events/application/ports/security-event-log.port.js';
import { decisionRecordFixture } from '../support/fixtures/decision-record.fixture.js';

export interface RecordStorePorts {
  readonly assessments: AssessmentRepository;
  readonly alerts: AlertRepository;
  readonly securityEvents: SecurityEventLog;
}

const assessment = (): RecordedRiskAssessment => ({ ...decisionRecordFixture().assessment, assessmentId: 'asm-contract-1', accountId: 'acct_tok_contract1', rulesetVersion: '2026.09.24' });

const securityEvent = (overrides: Partial<AccountSecurityEvent> = {}): AccountSecurityEvent => ({
  schemaVersion: '1.0',
  tenantId: 'BANK_A',
  eventId: 'SEC-contract-1',
  idempotencyKey: 'idem-SEC-contract-1',
  accountToken: 'acct_tok_contract1',
  eventType: 'NEW_DEVICE',
  deviceToken: 'dev_tok_contract9',
  occurredAt: '2026-09-24T10:00:30.000Z',
  ...overrides,
});

export function describeRecordStoresContract(adapterName: string, createStores: () => RecordStorePorts | Promise<RecordStorePorts>): void {
  describe(`Assessment, alert and security-event stores contract: ${adapterName}`, () => {
    it('inserts an assessment once and reads its contributions back unchanged', async () => {
      const { assessments } = await createStores();
      await assessments.insert(assessment());
      expect(await assessments.findById('asm-contract-1')).toEqual(assessment());
      await expect(assessments.insert(assessment())).rejects.toThrow();
    });

    it('keeps one open alert per account and replaces it by id', async () => {
      const { alerts } = await createStores();
      const alert = {
        id: 'alert-contract-1',
        accountId: 'acct_tok_contract1',
        transactionId: 'TX-1',
        assessmentId: 'asm-1',
        score: 49,
        band: 'ELEVATED' as const,
        onHold: false,
        status: 'OPEN' as const,
        raisedAt: '2026-09-24T10:00:42.000Z',
        updatedAt: '2026-09-24T10:00:42.000Z',
      };
      await alerts.save(alert);
      await alerts.save({ ...alert, score: 95, band: 'CRITICAL', onHold: true, updatedAt: '2026-09-24T10:00:45.000Z' });
      expect(await alerts.findOpenByAccountId('acct_tok_contract1')).toMatchObject({ id: 'alert-contract-1', score: 95, onHold: true });
      expect(await alerts.findOpenByAccountId('acct_tok_other')).toBeNull();
    });

    it('appends a security event once and answers a retry with the original', async () => {
      const { securityEvents } = await createStores();
      expect((await securityEvents.append(securityEvent())).outcome).toBe('CREATED');
      const retry = await securityEvents.append(securityEvent({ eventId: 'SEC-contract-retry' }));
      expect(retry).toEqual({ outcome: 'DUPLICATE', record: securityEvent() });
    });
  });
}
