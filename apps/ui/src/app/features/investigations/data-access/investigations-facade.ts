import { Injectable, computed, effect, inject, signal, untracked, type Signal } from '@angular/core';
import { Store } from '@ngrx/store';
import type { CaseSummary, DecisionRecord, EvidenceBundle, RiskExplanation } from '@sentinel/domain';
import { transactionsFeature } from '../../../state/transactions/transactions.feature';
import type { TapeRow } from '../../../workers/transaction-worker-protocol';
import { selectFocusedDecision } from '../../../state/account-focus/account-focus.selectors';
import type { AdvisoryState, RequestStatus, TimelineEntry } from '../models/investigation-view';
import { InvestigationsApi } from './investigations-api';

const TIMELINE_LIMIT = 24;
const IDLE = { status: 'IDLE', outcome: null } as const;

function timelineOf(evidence: EvidenceBundle, decided: ReadonlyMap<string, TapeRow>): readonly TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...evidence.recentTransactions.map((transaction) => {
      const row = decided.get(transaction.id);
      return {
        at: transaction.ts,
        kind: 'TRANSFER' as const,
        title: `${transaction.type.toLowerCase()} to ${transaction.destInstitutionId}`,
        detail: transaction.id,
        amount: transaction.amount,
        ...(row ? { decided: { score: row.score, band: row.band, decision: row.decision } } : {}),
      };
    }),
    ...evidence.interventions.map((intervention) => ({
      at: intervention.actedAt,
      kind: 'INTERVENTION' as const,
      title: `${intervention.state} by ${intervention.actor.toLowerCase()}`,
      detail: `${intervention.reasonCodes.join(', ')} · ${intervention.transactionId}`,
      amount: null,
      state: intervention.state,
    })),
    ...evidence.deviceHistory.map((event) => ({ at: event.occurredAt, kind: 'DEVICE' as const, title: event.eventType.replaceAll('_', ' ').toLowerCase(), detail: event.deviceId, amount: null })),
    ...evidence.payeeHistory.map((event) => ({ at: event.occurredAt, kind: 'PAYEE' as const, title: 'payee added', detail: event.payeeId, amount: null })),
  ];
  return entries.sort((left, right) => right.at.localeCompare(left.at)).slice(0, TIMELINE_LIMIT);
}

/**
 * The investigation workspace for the account in focus (M§5.4): the evidence bundle exactly as sentinel-core
 * compiled it, then advice on request. Route-scoped, local UI state in signals.
 */
@Injectable()
export class InvestigationsFacade {
  private readonly api = inject(InvestigationsApi);

  private readonly store = inject(Store);
  readonly decision: Signal<DecisionRecord | null> = this.store.selectSignal(selectFocusedDecision);
  /** The gate's recorded score and decision per transaction, from the live tape, for the timeline. */
  private readonly tape = this.store.selectSignal(transactionsFeature.selectTape);
  readonly assessmentId = computed(() => this.decision()?.assessmentId ?? null);

  private readonly evidenceState = signal<{ readonly status: RequestStatus; readonly evidence: EvidenceBundle | null }>({ status: 'IDLE', evidence: null });
  private readonly explanationState = signal<AdvisoryState<RiskExplanation>>(IDLE);
  private readonly summaryState = signal<AdvisoryState<CaseSummary>>(IDLE);

  readonly evidenceStatus = computed(() => this.evidenceState().status);
  readonly evidence = computed(() => this.evidenceState().evidence);
  readonly explanation = this.explanationState.asReadonly();
  readonly summary = this.summaryState.asReadonly();
  readonly timeline = computed(() => {
    const evidence = this.evidence();
    if (!evidence) return [];
    return timelineOf(evidence, new Map(this.tape().map((row) => [row.transactionId, row])));
  });

  constructor() {
    effect(() => {
      const assessmentId = this.assessmentId();
      untracked(() => this.open(assessmentId));
    });
  }

  explain(): void {
    const assessmentId = this.assessmentId();
    if (!assessmentId || this.explanationState().status === 'LOADING') return;
    this.explanationState.set({ status: 'LOADING', outcome: null });
    this.api.explain(assessmentId).subscribe({
      next: (outcome) => this.explanationState.set({ status: 'READY', outcome }),
      error: () => this.explanationState.set({ status: 'FAILED', outcome: null }),
    });
  }

  summarise(): void {
    const assessmentId = this.assessmentId();
    if (!assessmentId || this.summaryState().status === 'LOADING') return;
    this.summaryState.set({ status: 'LOADING', outcome: null });
    this.api.summarise(assessmentId).subscribe({
      next: (outcome) => this.summaryState.set({ status: 'READY', outcome }),
      error: () => this.summaryState.set({ status: 'FAILED', outcome: null }),
    });
  }

  private open(assessmentId: string | null): void {
    this.explanationState.set(IDLE);
    this.summaryState.set(IDLE);
    if (!assessmentId) {
      this.evidenceState.set({ status: 'IDLE', evidence: null });
      return;
    }
    this.evidenceState.set({ status: 'LOADING', evidence: null });
    this.api.evidence(assessmentId).subscribe({
      next: ({ assessmentId: loaded, evidence }) => {
        if (loaded === this.assessmentId()) this.evidenceState.set({ status: 'READY', evidence });
      },
      error: () => this.evidenceState.set({ status: 'FAILED', evidence: null }),
    });
  }
}
