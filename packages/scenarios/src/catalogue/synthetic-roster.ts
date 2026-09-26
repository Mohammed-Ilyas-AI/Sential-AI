import type { InstitutionId, MinorUnits } from '@sentinel/domain';

export interface SyntheticAccount {
  readonly displayId: string;
  readonly institutionId: InstitutionId;
  readonly openedAt: string;
  /** Fixed where the HTML reference fixes it; otherwise drawn from the seed. */
  readonly balance?: MinorUnits;
}

/** The twelve synthetic accounts of the HTML reference, four per institution. */
export const SYNTHETIC_ACCOUNTS: readonly SyntheticAccount[] = [
  { displayId: 'ACC-10291', institutionId: 'BANK_A', openedAt: '2021-01-12T00:00:00.000Z', balance: 5_200_000 },
  { displayId: 'ACC-20441', institutionId: 'BANK_A', openedAt: '2024-02-09T00:00:00.000Z', balance: 940_000 },
  { displayId: 'ACC-40118', institutionId: 'BANK_A', openedAt: '2020-06-01T00:00:00.000Z' },
  { displayId: 'ACC-61284', institutionId: 'BANK_A', openedAt: '2019-11-20T00:00:00.000Z' },
  { displayId: 'ACC-31760', institutionId: 'BANK_B', openedAt: '2019-08-03T00:00:00.000Z', balance: 6_100_000 },
  { displayId: 'ACC-55902', institutionId: 'BANK_B', openedAt: '2023-11-17T00:00:00.000Z', balance: 880_000 },
  { displayId: 'ACC-70337', institutionId: 'BANK_B', openedAt: '2018-04-15T00:00:00.000Z' },
  { displayId: 'ACC-66104', institutionId: 'BANK_B', openedAt: '2022-09-30T00:00:00.000Z' },
  { displayId: 'ACC-20150', institutionId: 'BANK_C', openedAt: '2022-03-21T00:00:00.000Z', balance: 5_800_000 },
  { displayId: 'ACC-47219', institutionId: 'BANK_C', openedAt: '2024-05-30T00:00:00.000Z', balance: 910_000 },
  { displayId: 'ACC-82015', institutionId: 'BANK_C', openedAt: '2021-07-07T00:00:00.000Z' },
  { displayId: 'ACC-93370', institutionId: 'BANK_C', openedAt: '2020-12-01T00:00:00.000Z' },
];

/** Established payees every synthetic account already knows (HTML reference PAYEES). */
export const ESTABLISHED_PAYEES: readonly string[] = [
  'PAYEE-1104',
  'PAYEE-2251',
  'SP-UTILITIES',
  'SP-TELCO',
  'PAYEE-6630',
  'PAYEE-4417',
  'PAYEE-3208',
  'SP-INSURER',
];

/** The reference's 95th-percentile amount (S$3,000), applied to every synthetic account. */
export const SYNTHETIC_AMOUNT_P95: MinorUnits = 300_000;

export const homeDeviceOf = (displayId: string): string => `DEV-${displayId}-HOME`;
