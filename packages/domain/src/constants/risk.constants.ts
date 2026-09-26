import type { EdgeLinkage, EdgeScoring } from '../graph/edge-evidence.js';
import type { RiskRuleCode } from '../risk/contribution.js';
import type { RiskBand } from '../risk/risk-assessment.js';

export const RULESET_VERSION = '2026.09.24';

export const MAX_RISK_SCORE = 100;

/** Maximum points per rule (T§3). They sum to MAX_RISK_SCORE. */
export const RULE_MAX_POINTS: Readonly<Record<RiskRuleCode, number>> = {
  RAPID_DRAIN: 30,
  NEW_DEVICE: 21,
  NEW_PAYEE: 16,
  VELOCITY: 12,
  ENTITY_LINK: 9,
  BEHAVIOUR_DEV: 7,
  COOLING_OFF: 5,
};

/** Labels shown in the attribution panel, as the HTML reference writes them. */
export const RULE_LABELS: Readonly<Record<RiskRuleCode, string>> = {
  RAPID_DRAIN: 'Rapid account depletion',
  NEW_DEVICE: 'New device',
  NEW_PAYEE: 'New beneficiary',
  VELOCITY: 'Transaction velocity',
  ENTITY_LINK: 'Suspicious entity relationship',
  BEHAVIOUR_DEV: 'Behavioural deviation',
  COOLING_OFF: 'Cooling-off period active',
};

/** Inclusive lower bound of each band. */
export const RISK_BAND_LOWER_BOUNDS: Readonly<Record<RiskBand, number>> = {
  LOW: 0,
  ELEVATED: 40,
  HIGH: 65,
  CRITICAL: 85,
};

/**
 * Rule parameters. Thresholds and maxima are from T§3; the scaling factors between them are from the HTML
 * behavioural reference (docs/reference/sentinel-ai-prototype.html, RULES).
 */
export const RULE_PARAMETERS = {
  rapidDrain: { zeroPointsAtDrainPercent: 25, maxPointsAtDrainPercent: 50 },
  newDevice: { firstSeenWithinHours: 24 },
  newPayee: { fullPointsWithinHours: 24, reducedPointsWithinHours: 168, reducedPoints: 8 },
  velocity: { baselineMultiple: 3, pointsPerMultipleAboveBaseline: 6 },
  entityLink: { maxHops: 2 },
  behaviourDeviation: { percentile: 95, distributionDays: 90 },
  coolingOff: { windowHours: 12 },
} as const;

/** Points per flagged entity by link strength. CANDIDATE and NONE links are shown in the graph, never scored. */
export const ENTITY_LINK_POINTS: Readonly<Record<EdgeScoring, number>> = {
  CONFIRMED: 3,
  STRONG: 2,
  CANDIDATE: 0,
  NONE: 0,
};

export const LINKAGE_SCORING: Readonly<Record<EdgeLinkage, EdgeScoring>> = {
  DIRECT: 'CONFIRMED',
  NETWORK_REFERENCE: 'CONFIRMED',
  NETWORK_TOKEN: 'STRONG',
  CORRELATED: 'CANDIDATE',
  UNOBSERVED: 'NONE',
};

/** Strongest first; a two-hop path is only as strong as its weakest link. */
export const LINKAGE_STRENGTH_ORDER: readonly EdgeLinkage[] = [
  'DIRECT',
  'NETWORK_REFERENCE',
  'NETWORK_TOKEN',
  'CORRELATED',
  'UNOBSERVED',
];
