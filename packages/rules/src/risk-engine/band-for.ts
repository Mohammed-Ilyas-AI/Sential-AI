import { RISK_BAND_LOWER_BOUNDS, type RiskBand } from '@sentinel/domain';

export type BandForScore = (score: number) => RiskBand;

/** LOW 0-39, ELEVATED 40-64, HIGH 65-84, CRITICAL 85-100. */
export const bandFor: BandForScore = (score) => {
  if (score >= RISK_BAND_LOWER_BOUNDS.CRITICAL) return 'CRITICAL';
  if (score >= RISK_BAND_LOWER_BOUNDS.HIGH) return 'HIGH';
  if (score >= RISK_BAND_LOWER_BOUNDS.ELEVATED) return 'ELEVATED';
  return 'LOW';
};
