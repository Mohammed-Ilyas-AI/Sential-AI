/** The only source of randomness in scenarios. Math.random is never used, so a seed replays exactly. */
export interface SeededRandom {
  /** Uniform in [0, 1). */
  next(): number;
}

/** mulberry32: small, fast and identical in Node and the browser. */
export function createSeededRandom(seed: number): SeededRandom {
  let state = seed >>> 0;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let mixed = state;
      mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
      mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
      return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
    },
  };
}
