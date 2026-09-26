import type { MinorUnits } from '@sentinel/domain';

const WHOLE_DOLLARS = new Intl.NumberFormat('en-SG', { maximumFractionDigits: 0 });

/** Whole Singapore dollars, as the HTML reference prints contribution details. */
export function formatWholeDollars(amount: MinorUnits): string {
  return `S$${WHOLE_DOLLARS.format(Math.round(amount / 100))}`;
}

/** "45 min", "3 h" or "2 d", as the HTML reference prints ages. */
export function formatAge(hours: number): string {
  if (hours < 1) return `${Math.max(0, Math.round(hours * 60))} min`;
  if (hours < 24) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} d`;
}

export function clampPoints(points: number, maxPoints: number): number {
  return Math.max(0, Math.min(maxPoints, points));
}
