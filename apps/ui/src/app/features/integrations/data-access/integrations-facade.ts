import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { CoreApiClient } from '../../../core/http/api-client/core-api-client';
import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import { StreamTelemetry } from '../../../core/realtime/stream-telemetry/stream-telemetry';
import { sessionFeature } from '../../../state/session/session.feature';
import { transactionsFeature } from '../../../state/transactions/transactions.feature';

export type ConnectorCategory = 'Banking' | 'Platform' | 'Data' | 'AI';

/**
 * How healthy a connector is, and how we know. HEALTHY and DEGRADED are observed; INFERRED is deduced from data
 * that could not flow without it; IDLE means reachable but quiet; UNOBSERVABLE means the browser cannot see it.
 */
export type ConnectorStatus = 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'IDLE' | 'INFERRED' | 'UNOBSERVABLE';

export interface ConnectorFact {
  readonly label: string;
  readonly value: string;
  /** Rendered masked: a secret is never shown, only where it lives. */
  readonly secret?: boolean;
}

export interface Connector {
  readonly id: string;
  readonly name: string;
  readonly category: ConnectorCategory;
  readonly kind: string;
  readonly description: string;
  readonly endpoint: string;
  readonly environment: string;
  readonly status: ConnectorStatus;
  /** What the status rests on, in one sentence. */
  readonly basis: string;
  /** The last time data or a probe confirmed this connector; null when nothing has. */
  readonly lastSync: string | null;
  readonly configuration: readonly ConnectorFact[];
  readonly flow: readonly ConnectorFact[];
  /** Search term the Audit Logs page can filter by, for connectors whose activity is recorded there. */
  readonly auditQuery?: string;
  readonly probe?: 'core';
}

interface Probe {
  readonly at: string;
  readonly ok: boolean;
  readonly latencyMs: number;
  readonly detail: string;
}

const IDLE_AFTER_MS = 60 * 60 * 1000;
const institution = (id: string) => (/^BANK_([A-Z])$/.exec(id) ? `Bank ${id.slice(-1)}` : id);

/**
 * Integrations (route-scoped). Every connector listed is one this deployment actually uses, and every status
 * says how it is known: observed by a live probe or stream, inferred from data that could not otherwise arrive,
 * or not observable from the browser. Connectors are provisioned through deployment configuration, so this
 * page only reads and probes; it never edits a connection or reveals a secret.
 */
@Injectable()
export class IntegrationsFacade {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly core = inject(CoreApiClient);
  private readonly config = inject(RUNTIME_CONFIG);
  private readonly telemetry = inject(StreamTelemetry);
  private readonly tape = this.store.selectSignal(transactionsFeature.selectTape);
  private readonly streamStatus = this.store.selectSignal(sessionFeature.selectStreamStatus);

  readonly environment = computed(() => {
    const host = (() => {
      try {
        return new URL(this.config.coreApiBaseUrl).hostname;
      } catch {
        return this.config.coreApiBaseUrl;
      }
    })();
    return host === 'localhost' || host === '127.0.0.1' ? 'Local' : host.endsWith('.run.app') ? 'Cloud Run' : host;
  });

  private readonly probes = signal<readonly Probe[]>([]);
  readonly probing = signal(false);
  readonly lastProbe = computed(() => this.probes().at(-1) ?? null);
  readonly probeHistory = this.probes.asReadonly();

  readonly connectors = computed<readonly Connector[]>(() => {
    const tape = this.tape();
    const live = this.streamStatus() === 'LIVE';
    const env = this.environment();
    const now = Date.now();
    const banks = [...new Set(tape.flatMap((row) => [row.institutionId, row.destinationInstitutionId]))].sort();
    const bankConnectors = banks.map((id): Connector => {
      const sent = tape.filter((row) => row.institutionId === id);
      const received = tape.filter((row) => row.destinationInstitutionId === id);
      const last = [...sent, ...received].map((row) => row.decidedAt).sort().at(-1) ?? null;
      const quiet = !last || now - Date.parse(last) > IDLE_AFTER_MS;
      return {
        id: `bank:${id}`,
        name: `${institution(id)} connector`,
        category: 'Banking',
        kind: 'Pre-transaction decision API',
        description: 'Asks for ALLOW / HOLD / REJECT before each transfer commits, using the canonical event contract.',
        endpoint: `${this.config.coreApiBaseUrl}/v1/decision/transactions`,
        environment: `${env} · synthetic institution`,
        status: sent.length === 0 && received.length === 0 ? 'UNOBSERVABLE' : quiet ? 'IDLE' : 'HEALTHY',
        basis: quiet ? 'No decision for this institution in the last hour.' : 'Decisions for this institution are arriving on the live stream.',
        lastSync: last,
        configuration: [
          { label: 'Institution', value: id },
          { label: 'Contract', value: 'TransactionEvent 1.0 · tokenised identifiers' },
          { label: 'Played by', value: 'sentinel-simulator (Cloud Run Job)' },
          { label: 'Bank credentials', value: 'none: synthetic institution', secret: true },
        ],
        flow: [
          { label: 'Decisions requested (on the tape)', value: String(sent.length) },
          { label: 'Transfers received', value: String(received.length) },
          { label: 'Held or rejected', value: String(sent.filter((row) => row.decision !== 'ALLOW').length) },
        ],
        auditQuery: id,
      };
    });
    const probe = this.lastProbe();
    const coreStatus: ConnectorStatus = !probe ? 'UNOBSERVABLE' : !probe.ok ? 'UNAVAILABLE' : probe.latencyMs > 2_000 ? 'DEGRADED' : 'HEALTHY';
    const latency = this.telemetry.frameLatencyMs();
    return [
      ...bankConnectors,
      {
        id: 'core',
        name: 'sentinel-core API',
        category: 'Platform',
        kind: 'REST API · Cloud Run service',
        description: 'Decision API, interventions and investigation evidence. Every page reads through it.',
        endpoint: this.config.coreApiBaseUrl,
        environment: env,
        status: coreStatus,
        basis: probe ? `${probe.ok ? 'Answered' : 'Did not answer'} a probe in ${probe.latencyMs} ms: ${probe.detail}.` : 'Not probed yet.',
        lastSync: probe?.ok ? probe.at : null,
        configuration: [
          { label: 'Base URL', value: this.config.coreApiBaseUrl },
          { label: 'Demo time compression', value: this.config.demoTimeCompression ? 'On · 24 h shown as 24 s' : 'Off' },
          { label: 'Database connection string', value: 'Secret Manager · never sent to the browser', secret: true },
        ],
        flow: [{ label: 'Probes this session', value: String(this.probes().length) }],
        probe: 'core',
      },
      {
        id: 'stream',
        name: 'sentinel-stream gateway',
        category: 'Platform',
        kind: 'WebSocket · Cloud Run service',
        description: 'Pushes decisions, alerts and interventions to the browser from MongoDB change streams.',
        endpoint: this.config.streamUrl,
        environment: env,
        status: live ? 'HEALTHY' : this.streamStatus() === 'RECONNECTING' ? 'DEGRADED' : 'UNAVAILABLE',
        basis: live ? `Connected${latency === null ? '' : `; last frame arrived ${latency} ms after it was emitted`}.` : `Connection state: ${this.streamStatus().toLowerCase()}.`,
        lastSync: tape[0]?.decidedAt ?? null,
        configuration: [
          { label: 'Stream URL', value: this.config.streamUrl },
          { label: 'Reconnect', value: 'Exponential backoff, resume from server cursor' },
        ],
        flow: [
          { label: 'Decisions on the tape', value: String(tape.length) },
          { label: 'Frame latency', value: latency === null ? 'not measured yet' : `${latency} ms` },
        ],
      },
      {
        id: 'atlas',
        name: 'MongoDB Atlas',
        category: 'Data',
        kind: 'Database · asia-southeast1',
        description: 'Accounts, decisions, assessments, interventions, alerts and the network graph.',
        endpoint: 'Server-side only',
        environment: env,
        status: live && tape.length > 0 ? 'INFERRED' : 'UNOBSERVABLE',
        basis: live && tape.length > 0 ? 'Live decisions arrive through Atlas change streams, so the database is answering.' : 'The browser never connects to the database.',
        lastSync: live ? (tape[0]?.decidedAt ?? null) : null,
        configuration: [
          { label: 'Connection string', value: 'Secret Manager', secret: true },
          { label: 'Network access', value: 'Cloud NAT address and named developer addresses only' },
        ],
        flow: [{ label: 'Read by', value: 'sentinel-core, sentinel-stream' }],
      },
      {
        id: 'pubsub',
        name: 'Cloud Pub/Sub',
        category: 'Data',
        kind: 'Event transport',
        description: 'Carries lifecycle events from the simulator to sentinel-core, ordered per account.',
        endpoint: 'Server-side only',
        environment: env,
        status: 'UNOBSERVABLE',
        basis: 'Subscription health is visible in Cloud Monitoring, not from the browser.',
        lastSync: null,
        configuration: [
          { label: 'Ordering key', value: 'Source account token' },
          { label: 'Push authentication', value: 'OIDC token verified by sentinel-core', secret: true },
        ],
        flow: [{ label: 'Delivered to', value: 'sentinel-core push endpoint' }],
      },
      {
        id: 'vertex',
        name: 'Vertex AI · Gemini',
        category: 'AI',
        kind: 'Generative AI · advisory only',
        description: 'Explains decisions and summarises cases on request. Never in the decision path.',
        endpoint: 'Server-side only',
        environment: env,
        status: 'UNOBSERVABLE',
        basis: 'Probing would spend a model call; its health shows on each Explain or Summarise request in Investigations.',
        lastSync: null,
        configuration: [
          { label: 'Model identifiers', value: 'Server configuration · never sent to the browser' },
          { label: 'Credentials', value: 'Service account (ADC) · no API key', secret: true },
        ],
        flow: [{ label: 'Called by', value: 'sentinel-core intelligence path' }],
      },
    ];
  });

  readonly category = signal<'ALL' | ConnectorCategory>('ALL');
  readonly status = signal<'ALL' | ConnectorStatus>('ALL');
  readonly query = signal('');
  readonly visible = computed(() => {
    const query = this.query().trim().toLowerCase();
    return this.connectors().filter(
      (connector) =>
        (this.category() === 'ALL' || connector.category === this.category()) &&
        (this.status() === 'ALL' || connector.status === this.status()) &&
        (!query || [connector.name, connector.kind, connector.description, connector.endpoint].some((value) => value.toLowerCase().includes(query))),
    );
  });
  readonly counts = computed(() => {
    const all = this.connectors();
    const count = (category: ConnectorCategory) => all.filter((connector) => connector.category === category).length;
    return { ALL: all.length, Banking: count('Banking'), Platform: count('Platform'), Data: count('Data'), AI: count('AI') };
  });
  readonly kpis = computed(() => {
    const all = this.connectors();
    return {
      total: all.length,
      healthy: all.filter((connector) => connector.status === 'HEALTHY' || connector.status === 'INFERRED').length,
      issues: all.filter((connector) => connector.status === 'DEGRADED' || connector.status === 'UNAVAILABLE').length,
      unobservable: all.filter((connector) => connector.status === 'UNOBSERVABLE').length,
      decisions: this.tape().length,
    };
  });

  readonly selectedId = signal<string | null>(null);
  readonly selected = computed(() => this.connectors().find((connector) => connector.id === this.selectedId()) ?? null);

  constructor() {
    this.refresh();
  }

  /** Probes sentinel-core: its health route, or, where Cloud Run reserves that path, its own JSON answer. */
  refresh(): void {
    if (this.probing()) return;
    this.probing.set(true);
    const started = performance.now();
    const done = (ok: boolean, detail: string) => {
      this.probes.update((probes) => [...probes.slice(-9), { at: new Date().toISOString(), ok, latencyMs: Math.round(performance.now() - started), detail }]);
      this.probing.set(false);
    };
    this.core.get<{ status?: string; uptimeSeconds?: number }>('/healthz').subscribe({
      next: (health) => done(health.status === 'ok', health.uptimeSeconds !== undefined ? `health ok, up ${Math.round(health.uptimeSeconds / 60)} min` : 'health ok'),
      error: () =>
        this.core.get<unknown>('/v1/health-probe').subscribe({
          next: () => done(true, 'service answered'),
          error: (error: unknown) => {
            const answered = error instanceof HttpErrorResponse && error.status === 404 && typeof error.error === 'object' && error.error !== null;
            done(answered, answered ? 'service answered (health route not exposed on Cloud Run)' : `no answer (HTTP ${error instanceof HttpErrorResponse ? error.status : 'error'})`);
          },
        }),
    });
  }

  viewLogs(connector: Connector): void {
    if (connector.auditQuery) void this.router.navigate(['/audit-logs'], { queryParams: { q: connector.auditQuery } });
  }
}
