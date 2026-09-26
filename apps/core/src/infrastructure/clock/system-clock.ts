import type { Clock } from '../../platform/time/clock.js';

export const systemClock: Clock = { now: () => new Date() };
