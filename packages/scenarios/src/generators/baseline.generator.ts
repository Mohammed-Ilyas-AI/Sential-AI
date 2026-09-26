import { NotYetImplementedError } from '@sentinel/domain';
import type { ScenarioStep } from '../scenario.js';
import type { ScenarioGenerator } from './scenario-generator.js';

/** Normal traffic: salary credits, bill payments, transfers to known payees, plausible diurnal rhythm. */
export const baselineGenerator: ScenarioGenerator<readonly ScenarioStep[]> = {
  name: 'baseline',
  generate() {
    throw new NotYetImplementedError('Baseline traffic generator', 'scheduled for build order step 2');
  },
};
