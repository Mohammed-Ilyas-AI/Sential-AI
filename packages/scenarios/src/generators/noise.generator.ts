import { NotYetImplementedError } from '@sentinel/domain';
import type { ScenarioStep } from '../scenario.js';
import type { ScenarioGenerator } from './scenario-generator.js';

/** Low-level oddities that score ELEVATED but never trip the gate: proves the system does not alarm on everything. */
export const noiseGenerator: ScenarioGenerator<readonly ScenarioStep[]> = {
  name: 'noise',
  generate() {
    throw new NotYetImplementedError('Noise generator', 'scheduled for build order step 2');
  },
};
