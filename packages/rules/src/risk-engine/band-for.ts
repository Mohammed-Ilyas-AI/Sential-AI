import type { RiskBand } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';

export type BandForScore = (score: number) => RiskBand;

/** Maps a score onto RISK_BAND_LOWER_BOUNDS: LOW 0-39, ELEVATED 40-64, HIGH 65-84, CRITICAL 85-100. */
export const bandFor: BandForScore = () => {
  throw new NotYetImplementedError('Risk band mapping', 'scheduled with the rules (build order step 6)');
};
