import { NotYetImplementedError } from '@sentinel/domain';
import type { Scenario } from '../scenario.js';

export type BuildDemoScenario = () => Scenario;

/**
 * Baseline traffic across 12 accounts, then the takeover of ACC-10291, built from the DEMO_TAKEOVER_01
 * constants in @sentinel/domain so the numbers on screen match the documents exactly.
 */
export const buildDemoTakeover01: BuildDemoScenario = () => {
  throw new NotYetImplementedError('DEMO_TAKEOVER_01 scenario', 'scheduled for build order step 2; locked 12 Oct');
};
