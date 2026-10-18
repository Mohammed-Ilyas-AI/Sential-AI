import { Injectable, computed, inject, signal, type Signal } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { DEFAULT_RAPID_DRAIN_POLICY } from '@sentinel/domain';
import { StreamTelemetry } from '../../../core/realtime/stream-telemetry/stream-telemetry';
import { ThemePreferences, type BrandPresetId } from '../../../core/theme/theme-preferences';
import { AlertsActions } from '../../../state/alerts/alerts.actions';
import { selectFocusedDecision } from '../../../state/account-focus/account-focus.selectors';
import { alertsFeature } from '../../../state/alerts/alerts.feature';
import { interventionsFeature } from '../../../state/interventions/interventions.feature';
import { sessionFeature, type StreamConnectionStatus } from '../../../state/session/session.feature';
import { transactionsFeature } from '../../../state/transactions/transactions.feature';
import type { GlobeScene, GlobeTarget } from '../components/operations-globe/globe-renderer';
import { INSTITUTION_ANCHORS } from '../geo/geo-anchors';
import type {
  AttentionItem,
  GlobeAction,
  GlobeCallout,
  GlobeDetail,
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
  buildNeedsAttention,
  buildNetworkStats,
  buildPolicyGate,
  buildRiskAnalysis,
  buildStreamRows,
  buildThreatLandscape,
} from './operations-overview.builder';

/** The synthetic bank lenses in the theme system, by institution. */
const BRAND_FOR_INSTITUTION: Readonly<Record<string, BrandPresetId>> = { BANK_A: 'bank-a', BANK_B: 'bank-b', BANK_C: 'bank-c' };

/** What the Control Tower consumes. The page talks to this facade, never to the store or HTTP directly. */
@Injectable({ providedIn: 'root' })
export class ControlTowerFacade {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly theme = inject(ThemePreferences);
  private readonly telemetry = inject(StreamTelemetry);
  private readonly fullTape = this.store.selectSignal(transactionsFeature.selectTape);

  /** The bank the analyst focused on the globe: every tower figure, the stream and the globe narrow to it. */
  private readonly bankFocusState = signal<string | null>(null);
  readonly bankFocus: Signal<string | null> = this.bankFocusState.asReadonly();
  readonly bankFocusLabel = computed(() => {
    const id = this.bankFocusState();
    return id ? (INSTITUTION_ANCHORS[id]?.label ?? id) : null;
  });
  /** The target selected on the globe, shown in its detail panel. */
  private readonly selectionState = signal<GlobeTarget | null>(null);
  readonly globeSelection: Signal<GlobeTarget | null> = this.selectionState.asReadonly();

  /** Transfers paid from or into the focused bank; the whole tape when no bank is focused. */
  private readonly tape = computed(() => {
    const bank = this.bankFocusState();
    const rows = this.fullTape();
    return bank ? rows.filter((row) => row.institutionId === bank || row.destinationInstitutionId === bank) : rows;
  });
  private readonly openAlerts = this.store.selectSignal(alertsFeature.selectOpenAlerts);
  private readonly activeHolds = this.store.selectSignal(interventionsFeature.selectActiveHolds);
  private readonly latestByTransaction = this.store.selectSignal(interventionsFeature.selectLatestByTransaction);
  private readonly focusedDecision = this.store.selectSignal(selectFocusedDecision);

  readonly streamStatus: Signal<StreamConnectionStatus> = this.store.selectSignal(sessionFeature.selectStreamStatus);
  readonly kpis: Signal<readonly KpiView[]> = computed(() => {
    const rows = this.tape();
    if (!this.bankFocusState()) return buildKpis(rows, this.openAlerts(), this.activeHolds());
    const accounts = new Set(rows.map((row) => row.accountId));
    const transactions = new Set(rows.map((row) => row.transactionId));
    return buildKpis(
      rows,
      this.openAlerts().filter((alert) => accounts.has(alert.accountId)),
      this.activeHolds().filter((hold) => transactions.has(hold.transactionId)),
    );
  });
  readonly globeScene: Signal<GlobeScene> = computed(() => buildGlobeScene(this.tape()));
  readonly globeCallouts: Signal<readonly GlobeCallout[]> = computed(() => buildGlobeCallouts(this.tape()));
  readonly networkStats: Signal<NetworkStats> = computed(() => buildNetworkStats(this.tape()));
  readonly streamRows: Signal<readonly StreamRow[]> = computed(() => buildStreamRows(this.tape()));
  readonly needsAttention: Signal<readonly AttentionItem[]> = computed(() =>
    buildNeedsAttention(this.openAlerts(), this.fullTape(), this.latestByTransaction()),
  );
  readonly threatLandscape: Signal<ThreatLandscapeView> = computed(() => buildThreatLandscape(this.tape()));
  readonly riskAnalysis: Signal<RiskAnalysisView | null> = computed(() => buildRiskAnalysis(this.focusedDecision()));

  readonly policyGate: Signal<PolicyGateView | null> = computed(() => {
    const decision = this.focusedDecision();
    const intervention = decision
      ? (this.latestByTransaction().find((candidate) => candidate.transactionId === decision.transactionId) ?? null)
      : null;
    return buildPolicyGate(decision, intervention, DEFAULT_RAPID_DRAIN_POLICY.gatePercent);
  });

  /** The selected target as the detail panel shows it, read from the whole tape (a focus never hides it). */
  readonly globeDetail: Signal<GlobeDetail | null> = computed(() => {
    const selection = this.selectionState();
    if (!selection) return null;
    const rows = this.fullTape();
    const label = (id: string) => INSTITUTION_ANCHORS[id]?.label ?? id;
    const alerted = new Set(this.openAlerts().map((alert) => alert.accountId));
    if (selection.kind === 'bank') {
      const out = rows.filter((row) => row.institutionId === selection.id);
      const into = rows.filter((row) => row.destinationInstitutionId === selection.id);
      return {
        kind: 'bank',
        id: selection.id,
        label: label(selection.id),
        focused: this.bankFocusState() === selection.id,
        transfersOut: out.length,
        transfersIn: into.length,
        held: [...out, ...into].filter((row) => row.decision !== 'ALLOW').length,
        accounts: new Set(out.map((row) => row.accountId)).size,
      };
    }
    if (selection.kind === 'transaction') {
      const row = rows.find((candidate) => candidate.transactionId === selection.id);
      if (!row) return null;
      const intervention = this.latestByTransaction().find((candidate) => candidate.transactionId === row.transactionId) ?? null;
      return {
        kind: 'transaction',
        id: row.transactionId,
        accountId: row.accountId,
        account: row.accountReference ?? row.accountId,
        from: label(row.institutionId),
        to: label(row.destinationInstitutionId),
        amount: row.amount,
        score: row.score,
        band: row.band,
        decision: row.decision,
        reasonCodes: row.reasonCodes,
        interventionState: intervention?.state ?? null,
        interventionActor: intervention?.actor ?? null,
        hasAlert: alerted.has(row.accountId),
      };
    }
    const own = rows.filter((row) => row.accountId === selection.id);
    const latest = own[0];
    if (!latest) return null;
    return {
      kind: 'account',
      id: selection.id,
      account: latest.accountReference ?? latest.accountId,
      institution: label(latest.institutionId),
      transfers: own.length,
      latestDecision: latest.decision,
      latestScore: latest.score,
      band: latest.band,
      hasAlert: alerted.has(selection.id),
    };
  });

  /** A click on the globe: a bank also becomes the tower's bank context; empty space clears the selection. */
  select(target: GlobeTarget | null): void {
    this.selectionState.set(target);
    if (target?.kind === 'bank') this.focusBank(target.id);
  }

  /** Narrows the tower to one bank and shows its synthetic lens, never changing light or dark; null restores. */
  focusBank(id: string | null): void {
    this.bankFocusState.set(id);
    this.theme.previewBrand(id ? (BRAND_FOR_INSTITUTION[id] ?? null) : null);
  }

  /** Every panel action goes through the existing routes and the store's account focus. */
  act(action: GlobeAction): void {
    switch (action.type) {
      case 'focus-bank':
        this.focusBank(action.id);
        return;
      case 'clear-bank':
        this.focusBank(null);
        this.selectionState.set(null);
        return;
      case 'bank-transactions':
        void this.router.navigate(['/live-transactions'], { queryParams: { bank: INSTITUTION_ANCHORS[action.id]?.label ?? action.id } });
        return;
      case 'open-transaction':
        void this.router.navigate(['/live-transactions'], { queryParams: { txn: action.id } });
        return;
      case 'open-alert':
        this.store.dispatch(AlertsActions.accountSelected({ accountId: action.accountId }));
        void this.router.navigateByUrl('/alerts');
        return;
      case 'open-investigation':
        this.store.dispatch(AlertsActions.accountSelected({ accountId: action.accountId }));
        void this.router.navigateByUrl('/investigations');
        return;
    }
  }

  /** Only what the browser can observe or knows by construction; nothing here is a fabricated latency. */
  readonly systemStatus: Signal<readonly SystemStatusRow[]> = computed(() => {
    const live = this.streamStatus() === 'LIVE';
    const latency = this.telemetry.frameLatencyMs();
    const policyVersion = this.focusedDecision()?.policyVersion ?? DEFAULT_RAPID_DRAIN_POLICY.policyVersion;
    return [
      { id: 'ingestion', label: 'Ingestion', value: live ? `${this.fullTape().length} scored` : 'Waiting', state: live ? 'operational' : 'degraded' },
      { id: 'rules', label: 'Rule Engine', value: '7 rules · deterministic', state: 'operational' },
      { id: 'policy', label: 'Policy Service', value: `SG-RD-50 · ${policyVersion}`, state: 'operational' },
      { id: 'ai', label: 'AI (Gemini)', value: 'Advisory · not in path', state: 'offline' },
      { id: 'websocket', label: 'WebSocket', value: live ? (latency === null ? 'Live' : `${latency} ms`) : 'Reconnecting', state: live ? 'operational' : 'degraded' },
    ];
  });
}
