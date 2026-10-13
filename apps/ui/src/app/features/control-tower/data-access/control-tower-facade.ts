import { Injectable, computed, inject, type Signal } from '@angular/core';
import { Store } from '@ngrx/store';
import { DEFAULT_RAPID_DRAIN_POLICY } from '@sentinel/domain';
import { StreamTelemetry } from '../../../core/realtime/stream-telemetry/stream-telemetry';
import { selectFocusedDecision } from '../../../state/account-focus/account-focus.selectors';
import { alertsFeature } from '../../../state/alerts/alerts.feature';
import { interventionsFeature } from '../../../state/interventions/interventions.feature';
import { sessionFeature, type StreamConnectionStatus } from '../../../state/session/session.feature';
import { transactionsFeature } from '../../../state/transactions/transactions.feature';
import type { GlobeScene } from '../components/operations-globe/globe-renderer';
import type {
  GlobeCallout,
  KpiView,
  NetworkStats,
  PolicyGateView,
  RiskAnalysisView,
  StreamRow,
  SystemStatusRow,
  ThreatLandscapeView,
} from '../models/operations-overview';
import {
  buildGlobeCallouts,
  buildGlobeScene,
  buildKpis,
  buildNetworkStats,
  buildPolicyGate,
  buildRiskAnalysis,
  buildStreamRows,
  buildThreatLandscape,
} from './operations-overview.builder';

/** What the Control Tower consumes. The page talks to this facade, never to the store or HTTP directly. */
@Injectable({ providedIn: 'root' })
export class ControlTowerFacade {
  private readonly store = inject(Store);
  private readonly telemetry = inject(StreamTelemetry);
  private readonly tape = this.store.selectSignal(transactionsFeature.selectTape);
  private readonly openAlerts = this.store.selectSignal(alertsFeature.selectOpenAlerts);
  private readonly activeHolds = this.store.selectSignal(interventionsFeature.selectActiveHolds);
  private readonly latestByTransaction = this.store.selectSignal(interventionsFeature.selectLatestByTransaction);
  private readonly focusedDecision = this.store.selectSignal(selectFocusedDecision);

  readonly streamStatus: Signal<StreamConnectionStatus> = this.store.selectSignal(sessionFeature.selectStreamStatus);
  readonly kpis: Signal<readonly KpiView[]> = computed(() => buildKpis(this.tape(), this.openAlerts(), this.activeHolds()));
  readonly globeScene: Signal<GlobeScene> = computed(() => buildGlobeScene(this.tape()));
  readonly globeCallouts: Signal<readonly GlobeCallout[]> = computed(() => buildGlobeCallouts(this.tape()));
  readonly networkStats: Signal<NetworkStats> = computed(() => buildNetworkStats(this.tape()));
  readonly streamRows: Signal<readonly StreamRow[]> = computed(() => buildStreamRows(this.tape()));
  readonly threatLandscape: Signal<ThreatLandscapeView> = computed(() => buildThreatLandscape(this.tape()));
  readonly riskAnalysis: Signal<RiskAnalysisView | null> = computed(() => buildRiskAnalysis(this.focusedDecision()));

  readonly policyGate: Signal<PolicyGateView | null> = computed(() => {
    const decision = this.focusedDecision();
    const intervention = decision
      ? (this.latestByTransaction().find((candidate) => candidate.transactionId === decision.transactionId) ?? null)
      : null;
    return buildPolicyGate(decision, intervention, DEFAULT_RAPID_DRAIN_POLICY.gatePercent);
  });

  /** Only what the browser can observe or knows by construction; nothing here is a fabricated latency. */
  readonly systemStatus: Signal<readonly SystemStatusRow[]> = computed(() => {
    const live = this.streamStatus() === 'LIVE';
    const latency = this.telemetry.frameLatencyMs();
    const policyVersion = this.focusedDecision()?.policyVersion ?? DEFAULT_RAPID_DRAIN_POLICY.policyVersion;
    return [
      { id: 'ingestion', label: 'Ingestion', value: live ? `${this.tape().length} scored` : 'Waiting', state: live ? 'operational' : 'degraded' },
      { id: 'rules', label: 'Rule Engine', value: '7 rules · deterministic', state: 'operational' },
      { id: 'policy', label: 'Policy Service', value: `SG-RD-50 · ${policyVersion}`, state: 'operational' },
      { id: 'ai', label: 'AI (Gemini)', value: 'Advisory · not in path', state: 'offline' },
      { id: 'websocket', label: 'WebSocket', value: live ? (latency === null ? 'Live' : `${latency} ms`) : 'Reconnecting', state: live ? 'operational' : 'degraded' },
    ];
  });
}
