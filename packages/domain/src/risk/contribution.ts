export type RiskRuleCode =
  | 'RAPID_DRAIN'
  | 'NEW_DEVICE'
  | 'NEW_PAYEE'
  | 'VELOCITY'
  | 'ENTITY_LINK'
  | 'BEHAVIOUR_DEV'
  | 'COOLING_OFF';

/** The single source of truth for the score. Written once by the engine and never modified. */
export interface Contribution {
  readonly code: RiskRuleCode;
  /** Human-readable, shown in the UI. */
  readonly label: string;
  readonly points: number;
  /** The actual value that fired the rule. */
  readonly detail: string;
}
