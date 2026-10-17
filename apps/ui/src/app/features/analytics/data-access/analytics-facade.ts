import { Injectable, computed, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { RULE_LABELS, type InterventionState, type RiskBand, type RiskRuleCode } from '@sentinel/domain';
import { interventionsFeature } from '../../../state/interventions/interventions.feature';
import { transactionsFeature } from '../../../state/transactions/transactions.feature';

export interface Bar {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  /** 0..100 of the largest bar in the same chart. */
  readonly share: number;
  readonly tone?: string;
}

const BANDS: readonly RiskBand[] = ['LOW', 'ELEVATED', 'HIGH', 'CRITICAL'];
const OUTCOMES: readonly InterventionState[] = ['HELD', 'RELEASED', 'REJECTED', 'CANCELLED'];

function bars(entries: readonly (readonly [string, string, number, string?])[]): readonly Bar[] {
  const largest = Math.max(1, ...entries.map(([, , value]) => value));
  return entries.map(([key, label, value, tone]) => ({ key, label, value, share: (value / largest) * 100, ...(tone ? { tone } : {}) }));
}

/**
 * Measured outcomes of the control over what the analyst's session holds: the live tape (the latest 200
 * decisions) and every intervention record. Counted, never modelled.
 */
@Injectable()
export class AnalyticsFacade {
  private readonly store = inject(Store);
  private readonly tape = this.store.selectSignal(transactionsFeature.selectTape);
  private readonly latestByAccount = this.store.selectSignal(transactionsFeature.selectLatestByAccount);
  private readonly latestInterventions = this.store.selectSignal(interventionsFeature.selectLatestByTransaction);

  readonly decisions = computed(() => this.tape().length);
  readonly holds = computed(() => this.tape().filter((row) => row.decision === 'HOLD').length);
  readonly valueScreened = computed(() => this.tape().reduce((sum, row) => sum + row.amount, 0));
  readonly valueHeld = computed(() => this.tape().reduce((sum, row) => (row.decision === 'HOLD' ? sum + row.amount : sum), 0));
  readonly holdRate = computed(() => (this.decisions() === 0 ? 0 : (this.holds() / this.decisions()) * 100));
  readonly byBand = computed(() => {
    const counts = new Map<RiskBand, number>();
    for (const row of this.tape()) counts.set(row.band, (counts.get(row.band) ?? 0) + 1);
    return bars(BANDS.map((band) => [band, band, counts.get(band) ?? 0] as const));
  });

  readonly byDecision = computed(() => {
    const counts = new Map<string, number>();
    for (const row of this.tape()) counts.set(row.decision, (counts.get(row.decision) ?? 0) + 1);
    return bars([
      ['ALLOW', 'Allowed', counts.get('ALLOW') ?? 0, 'success'],
      ['HOLD', 'Held by SG-RD-50', counts.get('HOLD') ?? 0, 'critical'],
      ['REJECT', 'Rejected', counts.get('REJECT') ?? 0, 'warning'],
    ]);
  });

  readonly outcomes = computed(() => {
    const counts = new Map<InterventionState, number>();
    for (const record of this.latestInterventions()) counts.set(record.state, (counts.get(record.state) ?? 0) + 1);
    return bars(OUTCOMES.map((state) => [state, state.toLowerCase(), counts.get(state) ?? 0] as const));
  });

  /** Points each rule contributed on every account's latest decision: which signals carry the risk right now. */
  readonly rulePoints = computed(() => {
    const points = new Map<RiskRuleCode, number>();
    for (const decision of Object.values(this.latestByAccount())) {
      for (const contribution of decision.assessment.contributions) points.set(contribution.code, (points.get(contribution.code) ?? 0) + contribution.points);
    }
    return bars(
      [...points.entries()].sort((left, right) => right[1] - left[1]).map(([code, value]) => [code, RULE_LABELS[code], value] as const),
    );
  });

  /** Decisions per minute over the tape, oldest first, for the throughput strip. */
  readonly perMinute = computed(() => {
    const buckets = new Map<string, number>();
    for (const row of this.tape()) {
      const minute = row.decidedAt.slice(0, 16);
      buckets.set(minute, (buckets.get(minute) ?? 0) + 1);
    }
    return [...buckets.entries()].sort(([left], [right]) => left.localeCompare(right)).slice(-30);
  });
}
