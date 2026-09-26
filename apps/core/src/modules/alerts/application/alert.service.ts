import type { Alert, DecisionRecord } from '@sentinel/domain';
import type { IdGenerator } from '../../../platform/ids/id-generator.js';
import type { AlertRepository } from './ports/alert-repository.port.js';
import type { RaiseAlert } from './raise-alert.use-case.js';

/** Keeps one open alert per account, tracking its latest decision; a hold keeps the alert marked as held. */
export class AlertService implements RaiseAlert {
  constructor(
    private readonly alerts: AlertRepository,
    private readonly ids: IdGenerator,
  ) {}

  async raiseFor(decision: DecisionRecord): Promise<Alert | null> {
    const held = decision.decision === 'HOLD';
    if (decision.band === 'LOW' && !held) return null;

    const existing = await this.alerts.findOpenByAccountId(decision.accountId);
    const alert: Alert = {
      id: existing?.id ?? this.ids.next(),
      accountId: decision.accountId,
      ...(decision.accountReference ? { accountReference: decision.accountReference } : {}),
      transactionId: decision.transactionId,
      assessmentId: decision.assessmentId,
      score: decision.riskScore,
      band: decision.band,
      onHold: held || existing?.onHold === true,
      status: 'OPEN',
      raisedAt: existing?.raisedAt ?? decision.decidedAt,
      updatedAt: decision.decidedAt,
    };
    await this.alerts.save(alert);
    return alert;
  }
}
