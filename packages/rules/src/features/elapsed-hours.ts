import type { IsoTimestamp } from '@sentinel/domain';

const MILLISECONDS_PER_HOUR = 3_600_000;

/** Hours from `from` to `to`, never negative. */
export function elapsedHours(from: IsoTimestamp, to: IsoTimestamp): number {
  return Math.max(0, (Date.parse(to) - Date.parse(from)) / MILLISECONDS_PER_HOUR);
}

export function addHours(at: IsoTimestamp, hours: number): IsoTimestamp {
  return new Date(Date.parse(at) + hours * MILLISECONDS_PER_HOUR).toISOString();
}

export function isAfter(candidate: IsoTimestamp | undefined, reference: IsoTimestamp): boolean {
  return candidate !== undefined && Date.parse(candidate) > Date.parse(reference);
}
