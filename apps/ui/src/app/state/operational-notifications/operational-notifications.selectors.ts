import type { Alert, Intervention } from '@sentinel/domain';
import { createSelector } from '@ngrx/store';
import type { TapeRow } from '../../workers/transaction-worker-protocol';
import { alertsFeature } from '../alerts/alerts.feature';
import { interventionsFeature } from '../interventions/interventions.feature';
import { transactionsFeature } from '../transactions/transactions.feature';

export type NotificationSeverity = 'critical' | 'warning' | 'info' | 'success';

/** One operational event worth an analyst's attention, derived from server truth, never invented. */
export interface OperationalNotification {
  readonly id: string;
  readonly severity: NotificationSeverity;
  readonly title: string;
  readonly description: string;
  readonly at: string;
  readonly accountId: string;
}

const NOTIFICATION_LIMIT = 20;

const displayAccount = (accountId: string, rows: readonly TapeRow[]): string =>
  rows.find((row) => row.accountId === accountId)?.accountReference ?? accountId;

function fromIntervention(intervention: Intervention, rows: readonly TapeRow[]): OperationalNotification {
  const account = displayAccount(intervention.accountId, rows);
  const base = { id: `intervention:${intervention.id}`, at: intervention.actedAt, accountId: intervention.accountId };
  switch (intervention.state) {
    case 'HELD':
      return {
        ...base,
        severity: 'critical',
        title: 'High-risk transaction held',
        description: `${account} · policy SG-RD-50 · score ${intervention.assessment.score}`,
      };
    case 'RELEASED':
      return {
        ...base,
        severity: 'success',
        title: intervention.actor === 'CUSTOMER' ? 'Customer verification received' : 'Hold released',
        description: `${account} · released by ${intervention.actor.toLowerCase()}`,
      };
    case 'CANCELLED':
      return { ...base, severity: 'info', title: 'Transfer cancelled by customer', description: account };
    case 'REJECTED':
      return { ...base, severity: 'critical', title: 'Fraud confirmed', description: `${account} · rejected by analyst` };
  }
}

function fromAlert(alert: Alert, rows: readonly TapeRow[]): OperationalNotification {
  return {
    id: `alert:${alert.id}:${alert.score}`,
    severity: alert.band === 'CRITICAL' ? 'critical' : 'warning',
    title: alert.band === 'CRITICAL' ? 'Critical risk alert' : 'New risk alert',
    description: `${alert.accountReference ?? displayAccount(alert.accountId, rows)} scored ${alert.score} (${alert.band.toLowerCase()})`,
    at: alert.updatedAt,
    accountId: alert.accountId,
  };
}

export const selectOperationalNotifications = createSelector(
  interventionsFeature.selectAllInterventions,
  alertsFeature.selectOpenAlerts,
  transactionsFeature.selectLatestByAccount,
  transactionsFeature.selectTape,
  (interventions, alerts, latestByAccount, rows): readonly OperationalNotification[] => {
    const flagged: OperationalNotification[] = Object.values(latestByAccount)
      .filter((decision) => decision.assessment.contributions.some((contribution) => contribution.code === 'ENTITY_LINK'))
      .map((decision) => ({
        id: `network:${decision.transactionId}`,
        severity: 'warning' as const,
        title: 'Network relationship flagged',
        description: `${decision.accountReference ?? decision.accountId} · destination linked to flagged entities`,
        at: decision.occurredAt,
        accountId: decision.accountId,
      }));
    const drains: OperationalNotification[] = Object.values(latestByAccount)
      .filter((decision) => decision.assessment.drain.thresholdMet)
      .map((decision) => ({
        id: `drain:${decision.transactionId}`,
        severity: 'info' as const,
        title: 'Rapid drain pattern',
        description: `${decision.assessment.drain.drainPct.toFixed(1)}% outflow in 24h window · ${decision.accountReference ?? decision.accountId}`,
        at: decision.occurredAt,
        accountId: decision.accountId,
      }));
    return [
      ...interventions.map((intervention) => fromIntervention(intervention, rows)),
      ...drains,
      ...alerts.filter((alert) => alert.band === 'HIGH' || alert.band === 'CRITICAL').map((alert) => fromAlert(alert, rows)),
      ...flagged,
    ]
      .sort((left, right) => right.at.localeCompare(left.at))
      .slice(0, NOTIFICATION_LIMIT);
  },
);
