import type { Account, AccountState, EdgeLinkage, IsoTimestamp, RiskFeatures } from '@sentinel/domain';
import { elapsedHours, isAfter } from './elapsed-hours.js';

export interface RiskFeatureInputs {
  readonly deviceToken: string | null;
  readonly payeeToken: string | null;
  readonly account: Account;
  readonly securityState: AccountState | null;
  readonly flaggedLinks: readonly EdgeLinkage[];
  readonly evaluatedAt: IsoTimestamp;
}

/**
 * Age of a device or payee at evaluation: from its first-seen record when there is one; null when the bank
 * reports it as established; zero (first seen now) when it is neither recorded nor known.
 */
function ageInHours(
  token: string | null,
  firstSeen: Readonly<Record<string, IsoTimestamp>> | undefined,
  known: readonly string[],
  evaluatedAt: IsoTimestamp,
): number | null {
  if (token === null) return null;
  const firstSeenAt = firstSeen?.[token];
  if (firstSeenAt !== undefined) return elapsedHours(firstSeenAt, evaluatedAt);
  return known.includes(token) ? null : 0;
}

/** The deterministic feature-extraction step between the transaction and the pure rules. */
export function extractRiskFeatures(inputs: RiskFeatureInputs): RiskFeatures {
  const { account, securityState, evaluatedAt } = inputs;
  const coolingOffUntil = securityState?.coolingOffUntil ?? account.coolingOffUntil;
  return {
    evaluatedAt,
    deviceToken: inputs.deviceToken,
    deviceAgeHours: ageInHours(inputs.deviceToken, securityState?.deviceFirstSeenAt, account.knownDeviceIds, evaluatedAt),
    payeeToken: inputs.payeeToken,
    payeeAgeHours: ageInHours(inputs.payeeToken, securityState?.payeeFirstSeenAt, account.knownPayeeIds, evaluatedAt),
    velocityRatio: account.behaviour.velocityRatio,
    amountP95: account.behaviour.amountP95,
    coolingOffActive: isAfter(coolingOffUntil, evaluatedAt),
    flaggedLinks: inputs.flaggedLinks,
  };
}

/** The most recently first-seen token in a record, if any. */
export function mostRecentlySeen(firstSeen: Readonly<Record<string, IsoTimestamp>> | undefined): string | null {
  let latest: [string, IsoTimestamp] | null = null;
  for (const entry of Object.entries(firstSeen ?? {})) {
    if (latest === null || Date.parse(entry[1]) > Date.parse(latest[1])) latest = entry;
  }
  return latest?.[0] ?? null;
}
