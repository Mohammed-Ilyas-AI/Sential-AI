import type { EdgeLinkage } from '../graph/edge-evidence.js';
import type { AccountSecurityEventType } from '../security-event/account-security-event.js';

/**
 * The four scenarios of the HTML behavioural reference (docs/reference/sentinel-ai-prototype.html, SCENARIOS and
 * buildScenario), ported as data: one source for the burst generator, its tests and the documents. Amounts are the
 * reference's unscaled minor units; the reference scales them by the account's balance over S$52,000
 * (`f = bal / 5_200_000`, rounded to whole dollars), except for the mule role, which plays at its own balance.
 * `gapMs` is the reference's delay before the step. Nothing here is a rule, curve or threshold.
 */
export type ReferenceScenarioKey = 'phishing' | 'mule' | 'smurf' | 'replay';

/** Which of a bank's accounts the reference plays the scenario on (TENANTS[t].demo or TENANTS[t].mule). */
export type ReferenceScenarioRole = 'demo' | 'mule';

/** o1 and o2 are the reference's destination slots: the other two banks when the run is cross-bank. */
export type ReferenceDestination = 'own' | 'o1' | 'o2';

export type ReferenceScenarioStep =
  | {
      readonly kind: 'security';
      readonly gapMs: number;
      readonly eventType: AccountSecurityEventType;
      readonly deviceId?: string;
      readonly payeeId?: string;
      /** When the reference dates the event in the past (payeeAgeHrs), in hours before the case starts. */
      readonly hoursBefore?: number;
    }
  | {
      readonly kind: 'transfer';
      readonly gapMs: number;
      readonly payeeId: string;
      readonly destination: ReferenceDestination;
      readonly amount: number;
      readonly velocityRatio: number;
      /** The device the reference's context carries for this transfer; `home` is the account's known device. */
      readonly device: 'home' | string;
      readonly flaggedLinks?: readonly EdgeLinkage[];
    }
  | { readonly kind: 'inbound'; readonly gapMs: number; readonly amount: number };

export interface ReferenceScenario {
  readonly key: ReferenceScenarioKey;
  readonly name: string;
  readonly blurb: string;
  readonly role: ReferenceScenarioRole;
  /** base.outflow24h: what the account already moved inside the window before the scenario starts. */
  readonly priorOutflow: number;
  readonly steps: readonly ReferenceScenarioStep[];
}

const SMURF_PAYEES = ['PAYEE-6613', 'PAYEE-2251', 'PAYEE-6613', 'PAYEE-4417', 'PAYEE-6613', 'PAYEE-2251', 'PAYEE-6613', 'PAYEE-4417'] as const;

export const REFERENCE_SCENARIOS: Readonly<Record<ReferenceScenarioKey, ReferenceScenario>> = {
  phishing: {
    key: 'phishing',
    name: 'Phishing takeover',
    blurb: 'New device, new payees, rapid drain',
    role: 'demo',
    priorOutflow: 800_000,
    steps: [
      { kind: 'security', gapMs: 400, eventType: 'NEW_DEVICE', deviceId: 'DEV-7f3a' },
      { kind: 'security', gapMs: 1_300, eventType: 'PAYEE_ADDED', payeeId: 'PAYEE-9281' },
      { kind: 'transfer', gapMs: 1_100, payeeId: 'PAYEE-9281', destination: 'o1', amount: 240_000, velocityRatio: 1.8, device: 'DEV-7f3a' },
      { kind: 'transfer', gapMs: 1_100, payeeId: 'PAYEE-9281', destination: 'o1', amount: 490_000, velocityRatio: 3.5, device: 'DEV-7f3a' },
      { kind: 'security', gapMs: 0, eventType: 'PAYEE_ADDED', payeeId: 'PAYEE-3821' },
      { kind: 'transfer', gapMs: 1_100, payeeId: 'PAYEE-3821', destination: 'o1', amount: 720_000, velocityRatio: 4.5, device: 'DEV-7f3a' },
      { kind: 'security', gapMs: 0, eventType: 'PAYEE_ADDED', payeeId: 'PAYEE-7742' },
      {
        kind: 'transfer',
        gapMs: 1_100,
        payeeId: 'PAYEE-7742',
        destination: 'o2',
        amount: 1_150_000,
        velocityRatio: 5.5,
        device: 'DEV-7f3a',
        flaggedLinks: ['NETWORK_REFERENCE', 'NETWORK_REFERENCE', 'NETWORK_REFERENCE', 'NETWORK_TOKEN', 'CORRELATED'],
      },
      { kind: 'transfer', gapMs: 900, payeeId: 'PAYEE-7742', destination: 'o2', amount: 300_000, velocityRatio: 5.5, device: 'DEV-7f3a' },
    ],
  },
  mule: {
    key: 'mule',
    name: 'Mule account',
    blurb: 'Receive and forward across banks',
    role: 'mule',
    priorOutflow: 20_000,
    steps: [
      { kind: 'inbound', gapMs: 400, amount: 880_000 },
      { kind: 'security', gapMs: 900, eventType: 'NEW_DEVICE', deviceId: 'DEV-19ce' },
      { kind: 'security', gapMs: 900, eventType: 'MOBILE_NUMBER_CHANGED' },
      { kind: 'security', gapMs: 900, eventType: 'PAYEE_ADDED', payeeId: 'PAYEE-5120' },
      { kind: 'transfer', gapMs: 1_100, payeeId: 'PAYEE-5120', destination: 'o2', amount: 420_000, velocityRatio: 3.8, device: 'DEV-19ce' },
      {
        kind: 'transfer',
        gapMs: 1_100,
        payeeId: 'PAYEE-5121',
        destination: 'o2',
        amount: 430_000,
        velocityRatio: 5.2,
        device: 'DEV-19ce',
        flaggedLinks: ['NETWORK_REFERENCE', 'NETWORK_REFERENCE', 'NETWORK_REFERENCE', 'CORRELATED'],
      },
    ],
  },
  smurf: {
    key: 'smurf',
    name: 'Smurfing',
    blurb: 'Many small transfers to fresh payees',
    role: 'demo',
    priorOutflow: 900_000,
    steps: [
      { kind: 'security', gapMs: 500, eventType: 'PAYEE_ADDED', payeeId: 'PAYEE-6613', hoursBefore: 2 },
      ...SMURF_PAYEES.map(
        (payeeId, index): ReferenceScenarioStep => ({
          kind: 'transfer',
          gapMs: 650,
          payeeId,
          destination: index % 2 ? 'o1' : 'own',
          amount: 110_000 + ((index * 37) % 5) * 6_000,
          velocityRatio: Number((1.4 + index * 0.5).toFixed(1)),
          device: 'home',
          ...(index === 7 ? { flaggedLinks: ['NETWORK_TOKEN', 'CORRELATED'] as const } : {}),
        }),
      ),
    ],
  },
  replay: {
    key: 'replay',
    name: 'Credential replay',
    blurb: 'Password reset, unseen device, one large transfer',
    role: 'demo',
    priorOutflow: 200_000,
    steps: [
      { kind: 'security', gapMs: 500, eventType: 'PASSWORD_CHANGED' },
      { kind: 'security', gapMs: 1_000, eventType: 'NEW_DEVICE', deviceId: 'DEV-a4d2' },
      { kind: 'security', gapMs: 1_000, eventType: 'PAYEE_ADDED', payeeId: 'PAYEE-8830' },
      { kind: 'transfer', gapMs: 1_200, payeeId: 'PAYEE-8830', destination: 'o1', amount: 1_800_000, velocityRatio: 2, device: 'DEV-a4d2' },
    ],
  },
};

/** The reference's TENANTS: each bank's demo and mule accounts and the demo account's balance (ACCOUNTS[demo].bal). */
export const REFERENCE_TENANTS = {
  BANK_A: { demo: 'ACC-10291', mule: 'ACC-20441', demoBalance: 5_200_000, muleBalance: 940_000 },
  BANK_B: { demo: 'ACC-31760', mule: 'ACC-55902', demoBalance: 6_100_000, muleBalance: 880_000 },
  BANK_C: { demo: 'ACC-20150', mule: 'ACC-47219', demoBalance: 5_800_000, muleBalance: 910_000 },
} as const;

export type ReferenceInstitution = keyof typeof REFERENCE_TENANTS;

export interface MultiScamBurstCaseSpec {
  readonly scenario: ReferenceScenarioKey;
  readonly institutionId: ReferenceInstitution;
  /** The account the case plays on: the bank's demo or mule account, or another of its synthetic accounts. */
  readonly accountDisplayId: string;
  /** The balance at window start, from the reference's ACCOUNTS for the role's account. */
  readonly balance: number;
  /** When the case starts, from the start of the burst. */
  readonly startMs: number;
}

const STAGGER_MS = 1_500;
const ORDER: readonly { readonly scenario: ReferenceScenarioKey; readonly institutionId: ReferenceInstitution; readonly accountDisplayId: string }[] = [
  { scenario: 'phishing', institutionId: 'BANK_A', accountDisplayId: 'ACC-10291' },
  { scenario: 'mule', institutionId: 'BANK_B', accountDisplayId: 'ACC-55902' },
  { scenario: 'smurf', institutionId: 'BANK_C', accountDisplayId: 'ACC-82015' },
  { scenario: 'replay', institutionId: 'BANK_A', accountDisplayId: 'ACC-61284' },
  { scenario: 'phishing', institutionId: 'BANK_B', accountDisplayId: 'ACC-31760' },
  { scenario: 'mule', institutionId: 'BANK_C', accountDisplayId: 'ACC-47219' },
  { scenario: 'smurf', institutionId: 'BANK_A', accountDisplayId: 'ACC-40118' },
  { scenario: 'replay', institutionId: 'BANK_B', accountDisplayId: 'ACC-66104' },
  { scenario: 'phishing', institutionId: 'BANK_C', accountDisplayId: 'ACC-20150' },
  { scenario: 'mule', institutionId: 'BANK_A', accountDisplayId: 'ACC-20441' },
  { scenario: 'smurf', institutionId: 'BANK_B', accountDisplayId: 'ACC-70337' },
  { scenario: 'replay', institutionId: 'BANK_C', accountDisplayId: 'ACC-93370' },
];

/**
 * MULTI_SCAM_BURST_01: the reference's four scenarios on all three banks at once, twelve cases on twelve accounts,
 * starting 1.5 s apart so they overlap. Cross-bank destinations (the reference's `cross` option). The rules decide
 * every transfer: which cases are held and which are only alerted is whatever the engine and SG-RD-50 return.
 */
export const MULTI_SCAM_BURST_01 = {
  scenarioId: 'MULTI_SCAM_BURST_01',
  seed: 20_261_121,
  cross: true,
  cases: ORDER.map(
    (entry, index): MultiScamBurstCaseSpec => ({
      ...entry,
      balance:
        REFERENCE_SCENARIOS[entry.scenario].role === 'mule'
          ? REFERENCE_TENANTS[entry.institutionId].muleBalance
          : REFERENCE_TENANTS[entry.institutionId].demoBalance,
      startMs: index * STAGGER_MS,
    }),
  ),
} as const;

/** The reference's amount scaling: `Math.round(v * f / 100) * 100` with `f = bal / 5_200_000`, or 1 for the mule role. */
export function scaleReferenceAmount(amount: number, role: ReferenceScenarioRole, balance: number): number {
  const factor = role === 'mule' ? 1 : balance / 5_200_000;
  return Math.round((amount * factor) / 100) * 100;
}
