import { NotYetImplementedError } from '@sentinel/domain';
import type { ScenarioStep } from '../scenario.js';
import type { ScenarioGenerator } from './scenario-generator.js';

/** Low-level oddities that score ELEVATED but never trip the gate: proves the system does not alarm on everything. */
export const noiseGenerator: ScenarioGenerator<unknown, readonly ScenarioStep[]> = {
  name: 'noise',
  generate() {
    throw new NotYetImplementedError('Noise generator', 'not part of DEMO_TAKEOVER_01; scheduled with the polish window');
  },
};
