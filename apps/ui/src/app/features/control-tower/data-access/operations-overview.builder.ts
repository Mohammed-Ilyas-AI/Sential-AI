import { DECISION_REASON, type Alert, type DecisionRecord, type Intervention } from '@sentinel/domain';
import type { TapeRow } from '../../../workers/transaction-worker-protocol';
import type { GlobeNode, GlobeRoute, GlobeScene, GlobeTone } from '../components/operations-globe/globe-renderer';
import { accountNodeFor } from '../geo/account-placement';
import { INSTITUTION_ANCHORS, anchorFor } from '../geo/geo-anchors';
import type {
  AttentionItem,
  GlobeCallout,
  KpiView,
  NetworkStats,
  PolicyGateView,
  RiskAnalysisView,
  StreamRow,
  StreamStatus,
  ThreatLandscapeView,
} from '../models/operations-overview';

const SERIES_BUCKETS = 24;
const STREAM_ROWS = 5;
/** Routes drawn on the globe: the most recent transfers on the tape. */
const LIVE_ROUTES = 28;
const RISK_CONTRIBUTIONS = 5;
const HOUR_MS = 3_600_000;
const institutionLabel = (id: string): string => INSTITUTION_ANCHORS[id]?.label ?? id;

/** Buckets the tape's own time span; every series is derived from decisions actually received. */
function seriesOf(rows: readonly TapeRow[], value: (bucket: readonly TapeRow[]) => number): readonly number[] {
  if (rows.length === 0) return Array.from({ length: SERIES_BUCKETS }, () => 0);
  const times = rows.map((row) => Date.parse(row.occurredAt));
  const earliest = Math.min(...times);
  const span = Math.max(1, Math.max(...times) - earliest);
  const buckets: TapeRow[][] = Array.from({ length: SERIES_BUCKETS }, () => []);
  rows.forEach((row, index) => {
    const position = Math.min(SERIES_BUCKETS - 1, Math.floor((((times[index] ?? earliest) - earliest) / span) * SERIES_BUCKETS));
    buckets[position]?.push(row);
  });
  return buckets.map(value);
}

function changeOf(series: readonly number[]): number | null {
  const half = Math.floor(series.length / 2);
  const earlier = series.slice(0, half).reduce((total, value) => total + value, 0);
  const later = series.slice(half).reduce((total, value) => total + value, 0);
  if (earlier === 0) return later === 0 ? 0 : null;
  return Math.round(((later - earlier) / earlier) * 1000) / 10;
}

const institutionsIn = (rows: readonly TapeRow[]): ReadonlySet<string> =>
  new Set(rows.flatMap((row) => [row.institutionId, row.destinationInstitutionId]));
const isHighRisk = (band: TapeRow['band']): boolean => band === 'HIGH' || band === 'CRITICAL';

export function buildKpis(rows: readonly TapeRow[], openAlerts: readonly Alert[], activeHolds: readonly Intervention[]): readonly KpiView[] {
  const kpi = (id: string, label: string, value: number, icon: KpiView['icon'], tone: KpiView['tone'], series: readonly number[]): KpiView => ({
    id,
    label,
    value,
    icon,
    tone,
    series,
    changePercent: changeOf(series),
  });
  return [
    kpi('transactions', 'Live Transactions', rows.length, 'transfer', 'accent', seriesOf(rows, (bucket) => bucket.length)),
    kpi(
      'alerts',
      'High Risk Alerts',
      openAlerts.filter((alert) => isHighRisk(alert.band)).length,
      'alert',
      'critical',
      seriesOf(rows, (bucket) => bucket.filter((row) => isHighRisk(row.band)).length),
    ),
    kpi('holds', 'Active Holds', activeHolds.length, 'shieldAlert', 'warning', seriesOf(rows, (bucket) => bucket.filter((row) => row.decision === 'HOLD').length)),
    kpi('institutions', 'Monitored Banks', institutionsIn(rows).size, 'bank', 'success', seriesOf(rows, (bucket) => institutionsIn(bucket).size)),
  ];
}

function toneOf(row: TapeRow): GlobeTone {
  if (row.decision !== 'ALLOW') return 'held';
  if (isHighRisk(row.band)) return 'high';
  return row.band === 'ELEVATED' ? 'elevated' : 'normal';
}

/** Every recent transfer becomes a route from its account's node to the receiving institution. */
export function buildGlobeScene(rows: readonly TapeRow[]): GlobeScene {
  const routes: GlobeRoute[] = [];
  const nodes = new Map<string, GlobeNode>();
  for (const row of rows.slice(0, LIVE_ROUTES)) {
    const source = anchorFor(row.institutionId);
    const destination = anchorFor(row.destinationInstitutionId);
    if (!source || !destination) continue;
    const node = nodes.get(row.accountId) ?? {
      id: row.accountId,
      point: accountNodeFor(row.accountId, source),
      label: `Account ${row.accountReference ?? row.accountId} · ${source.label}`,
    };
    nodes.set(row.accountId, node);
    routes.push({
      id: row.transactionId,
      from: node.point,
      to: destination,
      tone: toneOf(row),
      label: `Transfer ${institutionLabel(row.institutionId)} → ${destination.label} · ${row.decision} · score ${row.score}`,
    });
  }
  const heldDestinations = new Set(rows.filter((row) => row.decision === 'HOLD').map((row) => row.destinationInstitutionId));
  return {
    markers: Object.entries(INSTITUTION_ANCHORS).map(([id, anchor]) => ({
      id,
      point: anchor,
      tone: heldDestinations.has(id) ? 'held' : 'accent',
      label: anchor.label,
    })),
    nodes: [...nodes.values()],
    routes: routes.reverse(),
    holds: [...heldDestinations].flatMap((id) => {
      const anchor = anchorFor(id);
      return anchor ? [anchor] : [];
    }),
  };
}

/** One callout per institution: the latest hold there, else the latest transfer it received. */
export function buildGlobeCallouts(rows: readonly TapeRow[]): readonly GlobeCallout[] {
  const callouts = new Map<string, GlobeCallout>();
  const hold = rows.find((row) => row.decision === 'HOLD');
  if (hold && anchorFor(hold.destinationInstitutionId)) {
    callouts.set(hold.destinationInstitutionId, {
      id: hold.destinationInstitutionId,
      institution: institutionLabel(hold.destinationInstitutionId),
      amount: hold.amount,
      label: 'HOLD',
      detail: 'Rapid-drain pattern',
      tone: 'held',
      transactionId: hold.transactionId,
      accountId: hold.accountId,
    });
  }
  for (const row of rows) {
    if (callouts.has(row.destinationInstitutionId) || !anchorFor(row.destinationInstitutionId)) continue;
    const tone = toneOf(row);
    callouts.set(row.destinationInstitutionId, {
      id: row.destinationInstitutionId,
      institution: institutionLabel(row.destinationInstitutionId),
      amount: row.amount,
      label: tone === 'high' ? 'Under review' : tone === 'elevated' ? 'Elevated risk' : 'Legitimate',
      tone,
    });
  }
  return [...callouts.values()];
}

export function buildNetworkStats(rows: readonly TapeRow[]): NetworkStats {
  const recent = rows.slice(0, LIVE_ROUTES);
  return {
    banksConnected: institutionsIn(rows).size,
    activeRoutes: new Set(recent.map((row) => `${row.accountId}>${row.destinationInstitutionId}`)).size,
    accountsMonitored: new Set(rows.map((row) => row.accountId)).size,
  };
}

export function buildStreamRows(rows: readonly TapeRow[]): readonly StreamRow[] {
  return rows.slice(0, STREAM_ROWS).map((row) => {
    const status: StreamStatus = row.decision === 'ALLOW' ? (isHighRisk(row.band) ? 'REVIEW' : 'ALLOWED') : row.decision;
    return {
      transactionId: row.transactionId,
      at: row.occurredAt,
      amount: row.amount,
      from: institutionLabel(row.institutionId),
      to: institutionLabel(row.destinationInstitutionId),
      score: row.score,
      band: row.band,
      status,
    };
  });
}

const ATTENTION_ROWS = 3;

/** The highest-risk open alerts, newest first among equals, each with its transfer and its current state. */
export function buildNeedsAttention(alerts: readonly Alert[], rows: readonly TapeRow[], latest: readonly Intervention[]): readonly AttentionItem[] {
  return [...alerts]
    .sort((left, right) => right.score - left.score || right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, ATTENTION_ROWS)
    .map((alert) => {
      const row = rows.find((candidate) => candidate.transactionId === alert.transactionId);
      const intervention = latest.find((candidate) => candidate.transactionId === alert.transactionId);
      const decision = row?.decision;
      const status = intervention
        ? intervention.state === 'HELD'
          ? 'HOLD'
          : intervention.state
        : decision && decision !== 'ALLOW'
          ? decision
          : isHighRisk(alert.band)
            ? 'HIGH RISK'
            : 'REVIEW';
      const tone: AttentionItem['tone'] =
        status === 'HOLD' || status === 'REJECT' || status === 'REJECTED'
          ? 'held'
          : status === 'HIGH RISK'
            ? 'high'
            : status === 'REVIEW'
              ? 'elevated'
              : 'cleared';
      return {
        alertId: alert.id,
        accountId: alert.accountId,
        account: alert.accountReference ?? row?.accountReference ?? alert.accountId,
        transactionId: alert.transactionId,
        route: row ? `${institutionLabel(row.institutionId)} → ${institutionLabel(row.destinationInstitutionId)}` : null,
        amount: row?.amount ?? null,
        status,
        tone,
        at: alert.updatedAt,
      };
    });
}

export function buildThreatLandscape(rows: readonly TapeRow[]): ThreatLandscapeView {
  const levelOf = (row: TapeRow) => (isHighRisk(row.band) ? 'high' : row.band === 'ELEVATED' ? 'elevated' : 'normal');
  const rank = { normal: 0, elevated: 1, high: 2 } as const;
  const worst = new Map<string, 'high' | 'elevated' | 'normal'>();
  for (const row of rows) {
    const level = levelOf(row);
    const current = worst.get(row.destinationInstitutionId);
    if (!current || rank[level] > rank[current]) worst.set(row.destinationInstitutionId, level);
  }
  return {
    hotspots: [...worst.entries()].flatMap(([id, level]) => {
      const anchor = anchorFor(id);
      return anchor ? [{ id, latitude: anchor.latitude, longitude: anchor.longitude, level }] : [];
    }),
    high: rows.filter((row) => levelOf(row) === 'high').length,
    elevated: rows.filter((row) => levelOf(row) === 'elevated').length,
    normal: rows.filter((row) => levelOf(row) === 'normal').length,
  };
}

export function buildRiskAnalysis(decision: DecisionRecord | null): RiskAnalysisView | null {
  if (!decision) return null;
  return {
    account: decision.accountReference ?? decision.accountId,
    score: decision.riskScore,
    band: decision.band,
    contributions: [...decision.assessment.contributions].sort((left, right) => right.points - left.points).slice(0, RISK_CONTRIBUTIONS),
  };
}

export function buildPolicyGate(decision: DecisionRecord | null, intervention: Intervention | null, gatePercent: number): PolicyGateView | null {
  if (!decision) return null;
  const { drain } = decision.assessment;
  const [interventionTitle, interventionDetail] = (() => {
    if (decision.decision === 'ALLOW') return ['No intervention', 'Gate not met; the transfer was allowed'];
    switch (intervention?.state) {
      case 'RELEASED':
        return ['Hold released', `Released by ${intervention.actor.toLowerCase()}`];
      case 'CANCELLED':
        return ['Transfer cancelled', 'Cancelled by the customer'];
      case 'REJECTED':
        return ['Fraud confirmed', 'Rejected by the analyst'];
      default:
        return ['Intervention required', 'Customer verification pending'];
    }
  })();
  return {
    decision: decision.decision,
    drainPct: drain.drainPct,
    gatePercent,
    thresholdMet: drain.thresholdMet,
    cascade: decision.reasonCodes.includes(DECISION_REASON.holdCascade),
    protectedAccount: !decision.reasonCodes.includes(DECISION_REASON.notProtected),
    interventionTitle,
    interventionDetail,
    demoTime: !!decision.holdUntil && Date.parse(decision.holdUntil) - Date.parse(decision.decidedAt) < HOUR_MS,
  };
}
