import type { InstitutionId } from '@sentinel/domain';
import type { GeoPoint } from './land-mask';

/**
 * Illustrative placement of the three synthetic institutions. The banks are fictional; these points exist only
 * to draw the live global network and the threat landscape.
 */
export const INSTITUTION_ANCHORS: Readonly<Record<string, GeoPoint & { readonly label: string }>> = {
  BANK_A: { latitude: 51.5, longitude: -0.1, label: 'Bank A' },
  BANK_B: { latitude: 40.7, longitude: -74, label: 'Bank B' },
  BANK_C: { latitude: -26.2, longitude: 28, label: 'Bank C' },
};

export function anchorFor(institutionId: InstitutionId): (GeoPoint & { readonly label: string }) | null {
  return INSTITUTION_ANCHORS[institutionId] ?? null;
}
