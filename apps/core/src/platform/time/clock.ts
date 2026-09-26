/** Injected everywhere time matters, so the scenario test can run on a deterministic clock. */
export interface Clock {
  now(): Date;
}
