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

/** Inclusive lower bound of each band. */
export const RISK_BAND_LOWER_BOUNDS: Readonly<Record<RiskBand, number>> = {
  LOW: 0,
  ELEVATED: 40,
  HIGH: 65,
  CRITICAL: 85,
};

/**
 * Documented rule parameters (T§3). The scaling curves between these points are defined by the
 * HTML behavioural reference and are deliberately absent here.
 */
export const RULE_PARAMETERS = {
  rapidDrain: { zeroPointsAtDrainPercent: 25, maxPointsAtDrainPercent: 50 },
  newDevice: { firstSeenWithinHours: 24 },
  newPayee: { fullPointsWithinHours: 24, reducedPointsWithinDays: 7, reducedPoints: 8 },
  velocity: { baselineMultiple: 3 },
  entityLink: { maxHops: 2 },
  behaviourDeviation: { percentile: 95, distributionDays: 90 },
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
