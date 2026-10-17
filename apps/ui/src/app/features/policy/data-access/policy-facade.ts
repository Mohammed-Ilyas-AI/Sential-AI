import { Injectable, computed, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import {
  DEFAULT_RAPID_DRAIN_POLICY,
  RISK_BAND_LOWER_BOUNDS,
  RULE_LABELS,
  RULE_MAX_POINTS,
  RULE_PARAMETERS,
  RULESET_VERSION,
  type RiskBand,
  type RiskRuleCode,
} from '@sentinel/domain';
import { transactionsFeature } from '../../../state/transactions/transactions.feature';

export interface RuleRow {
  readonly code: RiskRuleCode;
  readonly label: string;
  readonly maxPoints: number;
  readonly fires: string;
}

const { rapidDrain, newDevice, newPayee, velocity, entityLink, behaviourDeviation, coolingOff } = RULE_PARAMETERS;

/** What makes each rule score, worded from RULE_PARAMETERS so the page cannot drift from the engine. */
const FIRES: Readonly<Record<RiskRuleCode, string>> = {
  RAPID_DRAIN: `Scales from 0 at ${rapidDrain.zeroPointsAtDrainPercent}% to full points at ${rapidDrain.maxPointsAtDrainPercent}% of the balance moved in 24h`,
  NEW_DEVICE: `Device first seen within ${newDevice.firstSeenWithinHours}h of the transfer`,
  NEW_PAYEE: `Payee added within ${newPayee.fullPointsWithinHours}h (full), or within ${newPayee.reducedPointsWithinHours}h (${newPayee.reducedPoints} points)`,
  VELOCITY: `${velocity.pointsPerMultipleAboveBaseline} points per multiple above ${velocity.baselineMultiple}× the account's baseline rate`,
  ENTITY_LINK: `Flagged entities within ${entityLink.maxHops} hops, by link strength (confirmed 3, strong 2, candidate 0)`,
  BEHAVIOUR_DEV: `Amount above the ${behaviourDeviation.percentile}th percentile of ${behaviourDeviation.distributionDays} days of history`,
  COOLING_OFF: `Credential or device change within the last ${coolingOff.windowHours}h`,
};

/**
 * The published control and the advisory rules as configured (M§5.7). The gate decides; the score explains.
 * Changing a threshold requires a new policy version, so the versions seen on the live tape are listed too.
 */
@Injectable()
export class PolicyFacade {
  private readonly tape = inject(Store).selectSignal(transactionsFeature.selectTape);

  readonly policy = DEFAULT_RAPID_DRAIN_POLICY;
  readonly rulesetVersion = RULESET_VERSION;
  readonly rules: readonly RuleRow[] = (Object.keys(RULE_MAX_POINTS) as RiskRuleCode[]).map((code) => ({
    code,
    label: RULE_LABELS[code],
    maxPoints: RULE_MAX_POINTS[code],
    fires: FIRES[code],
  }));
  readonly maxScore = this.rules.reduce((sum, rule) => sum + rule.maxPoints, 0);
  readonly largestRule = Math.max(...this.rules.map((rule) => rule.maxPoints));
  readonly bands = (Object.entries(RISK_BAND_LOWER_BOUNDS) as [RiskBand, number][]).map(([band, from], index, all) => ({
    band,
    from,
    to: (all[index + 1]?.[1] ?? this.maxScore + 1) - 1,
  }));

  readonly versionsInForce = computed(() => {
    const seen = new Map<string, number>();
    for (const row of this.tape()) {
      const key = `${row.policyVersion} · ruleset ${row.rulesetVersion}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    return [...seen.entries()].map(([versions, decisions]) => ({ versions, decisions }));
  });
}
