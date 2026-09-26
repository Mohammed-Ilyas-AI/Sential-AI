import { NotYetImplementedError } from '@sentinel/domain';
import type { ScenarioStep } from '../scenario.js';
import type { ScenarioGenerator } from './scenario-generator.js';

/** The phishing-driven account takeover chain: new device, new payee, rapid transfers. */
export const takeoverGenerator: ScenarioGenerator<readonly ScenarioStep[]> = {
  name: 'takeover',
  generate() {
    throw new NotYetImplementedError('Takeover generator', 'scheduled for build order step 2');
  },
};
