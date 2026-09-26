import type { SeededRandom } from '../seed/seeded-random.js';

/** Every generator draws only from the injected SeededRandom. */
export interface ScenarioGenerator<TInput, TOutput> {
  readonly name: string;
  generate(random: SeededRandom, input: TInput): TOutput;
}
