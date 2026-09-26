import type {
  Account,
  AccountPosture,
  AccountState,
  DesignatedBillingOrganisations,
  IsoTimestamp,
  RapidDrainPolicy,
  RollingWindow,
  Transaction,
} from '@sentinel/domain';
import { extractRiskFeatures, mostRecentlySeen } from '../features/extract-risk-features.js';
import { drainGate, isProtectedAtWindowStart } from '../policy-gate/drain-gate.js';
import { assess } from '../risk-engine/assess.js';
import type { RiskRule } from '../risk-engine/risk-rule.js';

export interface PostureInputs {
  readonly account: Account;
  readonly securityState: AccountState | null;
  readonly window: RollingWindow;
  readonly policy: RapidDrainPolicy;
  readonly evaluatedAt: IsoTimestamp;
  readonly rules: readonly RiskRule[];
}

const NO_DESIGNATED_BILLERS: DesignatedBillingOrganisations = { isDesignated: () => false };

/**
 * The account's risk with no transfer in flight: the latest new device and payee, the current window, no
 * amount. This is how the reference scores the climb to 21 and 37 before any money moves.
 */
export function assessPosture({ account, securityState, window, policy, evaluatedAt, rules }: PostureInputs): AccountPosture {
  const deviceToken = mostRecentlySeen(securityState?.deviceFirstSeenAt);
  const payeeToken = mostRecentlySeen(securityState?.payeeFirstSeenAt);
  const noTransfer: Transaction = {
    id: `posture:${account.id}`,
    ts: evaluatedAt,
    sourceAccountId: account.id,
    destAccountId: '',
    payeeId: payeeToken ?? '',
    deviceId: deviceToken ?? '',
    amount: 0,
    channel: 'APP',
    type: 'TRANSFER',
    institutionId: account.institutionId,
    destInstitutionId: account.institutionId,
  };
  const drain = drainGate(noTransfer, window, policy, NO_DESIGNATED_BILLERS);
  const features = extractRiskFeatures({ deviceToken, payeeToken, account, securityState, flaggedLinks: [], evaluatedAt });
  const assessment = assess(
    noTransfer,
    { ...account, protected: isProtectedAtWindowStart(window, policy) },
    { ...window, drain, features },
    rules,
  );
  return {
    accountId: account.id,
    score: assessment.score,
    band: assessment.band,
    contributions: assessment.contributions,
    evaluatedAt,
  };
}
