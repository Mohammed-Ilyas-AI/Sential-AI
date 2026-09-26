import type { Clock } from '../../../src/platform/time/clock.js';

/** A clock the test moves explicitly, so decidedAt, holdUntil and releases are deterministic. */
export class TestClock implements Clock {
  private current: number;

  constructor(start: string) {
    this.current = Date.parse(start);
  }

  now(): Date {
    return new Date(this.current);
  }

  set(at: string): void {
    this.current = Date.parse(at);
  }

  advanceBy(milliseconds: number): void {
    this.current += milliseconds;
  }
}
