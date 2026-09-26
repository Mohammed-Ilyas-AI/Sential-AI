/**
 * The numbers in the pitch, the documents and on screen (T§9). One source, imported by the scenario
 * generator, the CI assertion and the documentation.
 */
export const DEMO_TAKEOVER_01 = {
  scenarioId: 'DEMO_TAKEOVER_01',
  accountDisplayId: 'ACC-10291',
  baselineAccounts: 12,
  baselineWindowMs: 30_000,
  openingBalance: 5_200_000,
  /** Derived: S$34,000 moved in the window less the four scripted transfers. */
  priorOutflowInWindow: 800_000,
  totalMovedInWindow: 3_400_000,
  steps: [
    { atMs: 30_000, action: 'LOGIN_NEW_DEVICE', expectedScore: 21 },
    { atMs: 34_000, action: 'ADD_PAYEE', expectedScore: 37 },
    { atMs: 41_000, action: 'TRANSFER', amount: 240_000 },
    { atMs: 42_000, action: 'TRANSFER', amount: 490_000, expectedDrainPercent: 29.4, expectedScore: 49, expectedBand: 'ELEVATED' },
    { atMs: 43_000, action: 'TRANSFER', amount: 720_000, expectedDrainPercent: 43.3, expectedScore: 75, expectedBand: 'HIGH' },
    {
      atMs: 45_000,
      action: 'TRANSFER',
      amount: 1_150_000,
      expectedDrainPercent: 65.4,
      expectedScore: 95,
      expectedBand: 'CRITICAL',
      expectedDecision: 'HOLD',
    },
  ],
  customerNotificationAtMs: 46_000,
  thresholdMetOnTransfer: 4,
  finalScore: 95,
  finalContributions: {
    RAPID_DRAIN: 30,
    NEW_DEVICE: 21,
    NEW_PAYEE: 16,
    VELOCITY: 12,
    ENTITY_LINK: 9,
    BEHAVIOUR_DEV: 7,
  },
} as const;
