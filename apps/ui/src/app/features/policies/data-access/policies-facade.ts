import { Injectable, computed, inject, signal } from '@angular/core';
import { Store } from '@ngrx/store';
import {
  DECISION_REASON,
  DEFAULT_RAPID_DRAIN_POLICY,
  COOLING_OFF_HOURS,
  ENTITY_LINK_POINTS,
  MAX_RISK_SCORE,
  RAPID_DRAIN_RULE_ID,
  RISK_BAND_LOWER_BOUNDS,
  RULESET_VERSION,
  RULE_LABELS,
  RULE_MAX_POINTS,
  RULE_PARAMETERS,
  type Decision,
  type RiskBand,
  type RiskRuleCode,
} from '@sentinel/domain';
import { transactionsFeature } from '../../../state/transactions/transactions.feature';

export type RuleCategory = 'Transaction' | 'Device' | 'Beneficiary' | 'Network' | 'Behaviour' | 'Account';

/** One parameter of a rule, exactly as the ruleset defines it. */
export interface RuleParameter {
  readonly name: string;
  readonly value: string;
}

/** One firing of a rule on an account's latest decision: the engine's own points and detail, never recomputed. */
export interface RuleHit {
  readonly accountId: string;
  readonly reference: string;
  readonly points: number;
  readonly detail: string;
  readonly at: string;
  readonly decision: Decision;
}

export interface DetectionRule {
  readonly code: RiskRuleCode;
  readonly id: string;
  readonly name: string;
  readonly category: RuleCategory;
  readonly maxPoints: number;
  readonly summary: string;
  readonly parameters: readonly RuleParameter[];
  readonly hits: readonly RuleHit[];
}

const RULE_ORDER: readonly RiskRuleCode[] = ['RAPID_DRAIN', 'NEW_DEVICE', 'NEW_PAYEE', 'VELOCITY', 'ENTITY_LINK', 'BEHAVIOUR_DEV', 'COOLING_OFF'];

const CATEGORY: Readonly<Record<RiskRuleCode, RuleCategory>> = {
  RAPID_DRAIN: 'Transaction',
  NEW_DEVICE: 'Device',
  NEW_PAYEE: 'Beneficiary',
  VELOCITY: 'Transaction',
  ENTITY_LINK: 'Network',
  BEHAVIOUR_DEV: 'Behaviour',
  COOLING_OFF: 'Account',
};

/** What each rule looks at, in plain words; the numbers are the ruleset's own parameters below. */
const SUMMARY: Readonly<Record<RiskRuleCode, string>> = {
  RAPID_DRAIN: 'Share of the 24-hour window’s opening balance already moved out.',
  NEW_DEVICE: 'A device seen for the first time on the account.',
  NEW_PAYEE: 'A beneficiary added recently before the transfer.',
  VELOCITY: 'Transfer frequency against the account’s own baseline.',
  ENTITY_LINK: 'Flagged entities within reach in the relationship graph.',
  BEHAVIOUR_DEV: 'Amount against the account’s historical distribution.',
  COOLING_OFF: 'A transfer during the cooling-off window after a high-risk event.',
};

const hours = (value: number) => `${value} h`;
const PARAMETERS: Readonly<Record<RiskRuleCode, readonly RuleParameter[]>> = {
  RAPID_DRAIN: [
    { name: 'Zero points at drain', value: `${RULE_PARAMETERS.rapidDrain.zeroPointsAtDrainPercent}%` },
    { name: 'Maximum points at drain', value: `${RULE_PARAMETERS.rapidDrain.maxPointsAtDrainPercent}%` },
  ],
  NEW_DEVICE: [{ name: 'First seen within', value: hours(RULE_PARAMETERS.newDevice.firstSeenWithinHours) }],
  NEW_PAYEE: [
    { name: 'Full points within', value: hours(RULE_PARAMETERS.newPayee.fullPointsWithinHours) },
    { name: 'Reduced points within', value: hours(RULE_PARAMETERS.newPayee.reducedPointsWithinHours) },
    { name: 'Reduced points', value: String(RULE_PARAMETERS.newPayee.reducedPoints) },
  ],
  VELOCITY: [
    { name: 'Baseline multiple', value: `${RULE_PARAMETERS.velocity.baselineMultiple}×` },
    { name: 'Points per multiple above', value: String(RULE_PARAMETERS.velocity.pointsPerMultipleAboveBaseline) },
  ],
  ENTITY_LINK: [
    { name: 'Maximum hops', value: String(RULE_PARAMETERS.entityLink.maxHops) },
    ...(Object.entries(ENTITY_LINK_POINTS) as [string, number][]).map(([scoring, points]) => ({ name: `Points per ${scoring.toLowerCase()} link`, value: String(points) })),
  ],
  BEHAVIOUR_DEV: [
    { name: 'Percentile', value: `p${RULE_PARAMETERS.behaviourDeviation.percentile}` },
    { name: 'Distribution window', value: `${RULE_PARAMETERS.behaviourDeviation.distributionDays} days` },
  ],
  COOLING_OFF: [{ name: 'Window', value: hours(RULE_PARAMETERS.coolingOff.windowHours) }],
};

export type Tab = 'rules' | 'gate' | 'logic' | 'versions';

/**
 * Policies & Rules (route-scoped). The catalogue is the deterministic ruleset compiled into sentinel-core and
 * published in @sentinel/domain; nothing here can change it (a change needs a new ruleset or policy version).
 * Rule firings come from each account's latest recorded assessment; policy outcomes from the live tape.
 */
@Injectable()
export class PoliciesFacade {
  private readonly store = inject(Store);
  private readonly latestByAccount = this.store.selectSignal(transactionsFeature.selectLatestByAccount);
  private readonly tape = this.store.selectSignal(transactionsFeature.selectTape);

  readonly tab = signal<Tab>('rules');
  readonly query = signal('');
  readonly category = signal<'ALL' | RuleCategory>('ALL');
  readonly selectedCode = signal<RiskRuleCode | null>('RAPID_DRAIN');

  readonly rules = computed<readonly DetectionRule[]>(() => {
    const decisions = Object.values(this.latestByAccount());
    return RULE_ORDER.map((code, index) => ({
      code,
      id: `R-${String(index + 1).padStart(2, '0')}`,
      name: RULE_LABELS[code],
      category: CATEGORY[code],
      maxPoints: RULE_MAX_POINTS[code],
      summary: SUMMARY[code],
      parameters: PARAMETERS[code],
      hits: decisions
        .flatMap((record) =>
          record.assessment.contributions
            .filter((contribution) => contribution.code === code && contribution.points > 0)
            .map((contribution) => ({
              accountId: record.accountId,
              reference: record.accountReference ?? record.accountId,
              points: contribution.points,
              detail: contribution.detail,
              at: record.occurredAt,
              decision: record.decision,
            })),
        )
        .sort((a, b) => b.at.localeCompare(a.at)),
    }));
  });
  readonly visibleRules = computed(() => {
    const query = this.query().trim().toLowerCase();
    return this.rules().filter(
      (rule) =>
        (this.category() === 'ALL' || rule.category === this.category()) &&
        (!query || [rule.id, rule.code, rule.name, rule.summary, rule.category].some((value) => value.toLowerCase().includes(query))),
    );
  });
  readonly selected = computed(() => this.rules().find((rule) => rule.code === this.selectedCode()) ?? null);

  readonly accountsScored = computed(() => Object.keys(this.latestByAccount()).length);
  readonly kpis = computed(() => {
    const tape = this.tape();
    return {
      rules: RULE_ORDER.length,
      hits: this.rules().reduce((sum, rule) => sum + rule.hits.length, 0),
      holds: tape.filter((row) => row.decision === 'HOLD').length,
      rejects: tape.filter((row) => row.decision === 'REJECT').length,
      decided: tape.length,
    };
  });

  readonly policy = DEFAULT_RAPID_DRAIN_POLICY;
  readonly ruleId = RAPID_DRAIN_RULE_ID;
  readonly rulesetVersion = RULESET_VERSION;
  readonly coolingOffHours = COOLING_OFF_HOURS;
  readonly maxScore = MAX_RISK_SCORE;
  readonly maxRulePoints = Math.max(...Object.values(RULE_MAX_POINTS));

  /** How often each documented reason code appears on the decisions on the tape. */
  readonly outcomes = computed(() => {
    const tape = this.tape();
    const described: Readonly<Record<string, string>> = {
      [DECISION_REASON.thresholdExceeded]: 'Drain above the gate on a protected balance: HOLD',
      [DECISION_REASON.holdCascade]: 'Account already in hold state: later eligible outflow HOLD',
      [DECISION_REASON.gateNotMet]: 'Drain at or below the gate: ALLOW',
      [DECISION_REASON.notProtected]: 'Balance below the protected threshold: ALLOW',
      [DECISION_REASON.excluded]: 'Excluded payment type (bill, GIRO, standing instruction): ALLOW',
    };
    return Object.entries(described).map(([code, meaning]) => ({ code, meaning, count: tape.filter((row) => row.reasonCodes.includes(code)).length }));
  });

  /** Score bands with the decisions actually recorded in each: the score never changes the decision. */
  readonly bands = computed(() => {
    const tape = this.tape();
    const order: readonly RiskBand[] = ['LOW', 'ELEVATED', 'HIGH', 'CRITICAL'];
    return order.map((band, index) => {
      const next = order[index + 1];
      const rows = tape.filter((row) => row.band === band);
      return {
        band,
        from: RISK_BAND_LOWER_BOUNDS[band],
        to: next ? RISK_BAND_LOWER_BOUNDS[next] - 1 : MAX_RISK_SCORE,
        allow: rows.filter((row) => row.decision === 'ALLOW').length,
        hold: rows.filter((row) => row.decision === 'HOLD').length,
        reject: rows.filter((row) => row.decision === 'REJECT').length,
      };
    });
  });

  /** Policy and ruleset versions as stamped on the recorded decisions. */
  readonly versions = computed(() => {
    const seen = new Map<string, { policyVersion: string; rulesetVersion: string; count: number; first: string; last: string }>();
    for (const row of this.tape()) {
      const key = `${row.policyVersion}|${row.rulesetVersion}`;
      const known = seen.get(key);
      if (known) {
        known.count += 1;
        if (row.occurredAt < known.first) known.first = row.occurredAt;
        if (row.occurredAt > known.last) known.last = row.occurredAt;
      } else seen.set(key, { policyVersion: row.policyVersion, rulesetVersion: row.rulesetVersion, count: 1, first: row.occurredAt, last: row.occurredAt });
    }
    return [...seen.values()].sort((a, b) => b.last.localeCompare(a.last));
  });

  /** The ruleset as CSV: what each rule is, its weight, its parameters and how often it fired. */
  exportCsv(): string {
    const cell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const header = ['Rule', 'Code', 'Name', 'Category', 'Max points', 'Parameters', 'Accounts fired on', 'Ruleset'];
    const lines = this.rules().map((rule) =>
      [rule.id, rule.code, rule.name, rule.category, rule.maxPoints, rule.parameters.map((parameter) => `${parameter.name}: ${parameter.value}`).join('; '), rule.hits.length, this.rulesetVersion]
        .map(cell)
        .join(','),
    );
    return [header.map(cell).join(','), ...lines].join('\r\n');
  }
}
