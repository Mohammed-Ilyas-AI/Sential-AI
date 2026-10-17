import { Injectable, computed, inject, signal, type Signal } from '@angular/core';
import { Store } from '@ngrx/store';
import type { AdvisoryOutcome, CaseSummary, DecisionRecord } from '@sentinel/domain';
import { CoreApiClient } from '../../../core/http/api-client/core-api-client';
import { AlertsActions } from '../../../state/alerts/alerts.actions';
import { alertsFeature } from '../../../state/alerts/alerts.feature';
import { selectFocusedDecision, selectFocusedTimeline, type AccountEvent } from '../../../state/account-focus/account-focus.selectors';
import { sessionFeature } from '../../../state/session/session.feature';
import type { CaseListItem, CaseSignOff } from '../models/case-list-item';

export type SummaryState =
  | { readonly status: 'IDLE' | 'LOADING' | 'FAILED' }
  | { readonly status: 'READY'; readonly outcome: AdvisoryOutcome<CaseSummary> };

/**
 * Cases and the one-click case report (M§5.6). The report is a rendering of recorded facts plus, when the analyst
 * asks, a schema-validated Gemini summary; the analyst reviews and signs it. Nothing here changes a decision.
 */
@Injectable()
export class CasesFacade {
  private readonly store = inject(Store);
  private readonly core = inject(CoreApiClient);

  readonly cases: Signal<readonly CaseListItem[]> = computed(() =>
    this.store
      .selectSignal(alertsFeature.selectQueue)()
      .map((alert) => ({
        caseId: `CASE-${alert.id.slice(-8).toUpperCase()}`,
        accountId: alert.accountId,
        reference: alert.accountReference ?? alert.accountId,
        band: alert.band,
        score: alert.score,
        onHold: alert.onHold,
        openedAt: alert.raisedAt,
        alert,
      })),
  );
  readonly focusedAccountId = this.store.selectSignal(alertsFeature.selectFocusedAccountId);
  readonly selected = computed(() => this.cases().find((item) => item.accountId === this.focusedAccountId()) ?? null);
  readonly decision: Signal<DecisionRecord | null> = this.store.selectSignal(selectFocusedDecision);
  readonly timeline: Signal<readonly AccountEvent[]> = this.store.selectSignal(selectFocusedTimeline);
  readonly analystIdentity = this.store.selectSignal(sessionFeature.selectAnalystIdentity);

  private readonly summaries = signal<Readonly<Record<string, SummaryState>>>({});
  private readonly signOffs = signal<Readonly<Record<string, CaseSignOff>>>({});
  readonly summary = computed((): SummaryState => {
    const selected = this.selected();
    return (selected && this.summaries()[selected.caseId]) || { status: 'IDLE' };
  });
  readonly signOff = computed(() => {
    const selected = this.selected();
    return selected ? (this.signOffs()[selected.caseId] ?? null) : null;
  });

  select(accountId: string): void {
    this.store.dispatch(AlertsActions.accountSelected({ accountId }));
  }

  summarise(): void {
    const selected = this.selected();
    if (!selected || this.summary().status === 'LOADING') return;
    const { caseId } = selected;
    this.summaries.update((all) => ({ ...all, [caseId]: { status: 'LOADING' } }));
    this.core.post<AdvisoryOutcome<CaseSummary>>(`/v1/investigations/${encodeURIComponent(selected.alert.assessmentId)}/case-summary`, {}).subscribe({
      next: (outcome) => this.summaries.update((all) => ({ ...all, [caseId]: { status: 'READY', outcome } })),
      error: () => this.summaries.update((all) => ({ ...all, [caseId]: { status: 'FAILED' } })),
    });
  }

  sign(disposition: CaseSignOff['disposition'], note: string): void {
    const selected = this.selected();
    const analystIdentity = this.analystIdentity();
    if (!selected || !analystIdentity) return;
    this.signOffs.update((all) => ({
      ...all,
      [selected.caseId]: { caseId: selected.caseId, analystIdentity, disposition, note: note.trim(), signedAt: new Date().toISOString() },
    }));
  }
}
