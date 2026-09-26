export type ScenarioAction = 'LOGIN_NEW_DEVICE' | 'ADD_PAYEE' | 'TRANSFER' | 'NOOP';

export interface ScenarioStep {
  /** Offset from scenario start. */
  readonly atMs: number;
  readonly action: ScenarioAction;
  readonly params: Readonly<Record<string, unknown>>;
}

/** The same seed produces the same stream, the same scores and the same hold, every run. */
export interface Scenario {
  readonly id: string;
  readonly seed: number;
  readonly timeline: readonly ScenarioStep[];
}
