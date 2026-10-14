import type { AccountSecurityEvent, Alert, RecordedRiskAssessment } from '@sentinel/domain';
import type { AlertRepository } from '../../../src/modules/alerts/application/ports/alert-repository.port.js';
import type { AssessmentRepository } from '../../../src/modules/risk/application/ports/assessment-repository.port.js';
import type { SecurityEventLog } from '../../../src/modules/security-events/application/ports/security-event-log.port.js';
import type { IdempotentWriteResult } from '../../../src/platform/idempotency/idempotent-write.js';

export class InMemoryAssessmentRepository implements AssessmentRepository {
  private readonly assessments = new Map<string, RecordedRiskAssessment>();

  async insert(assessment: RecordedRiskAssessment): Promise<void> {
    if (this.assessments.has(assessment.assessmentId)) throw new Error(`Assessment ${assessment.assessmentId} already exists`);
    this.assessments.set(assessment.assessmentId, assessment);
  }

  async findById(assessmentId: string): Promise<RecordedRiskAssessment | null> {
    return this.assessments.get(assessmentId) ?? null;
  }
}

export class InMemoryAlertRepository implements AlertRepository {
  private readonly alerts = new Map<string, Alert>();

  async findOpenByAccountId(accountId: string): Promise<Alert | null> {
    return [...this.alerts.values()].find((alert) => alert.accountId === accountId && alert.status === 'OPEN') ?? null;
  }

  async save(alert: Alert): Promise<void> {
    this.alerts.set(alert.id, alert);
  }

  all(): readonly Alert[] {
    return [...this.alerts.values()];
  }
}

export class InMemorySecurityEventLog implements SecurityEventLog {
  private readonly events = new Map<string, AccountSecurityEvent>();

  async append(event: AccountSecurityEvent): Promise<IdempotentWriteResult<AccountSecurityEvent>> {
    const original = this.events.get(event.idempotencyKey);
    if (original) return { outcome: 'DUPLICATE', record: original };
    this.events.set(event.idempotencyKey, event);
    return { outcome: 'CREATED', record: event };
  }

  all(): readonly AccountSecurityEvent[] {
    return [...this.events.values()];
  }
}
