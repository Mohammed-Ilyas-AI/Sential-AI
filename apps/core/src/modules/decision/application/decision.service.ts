import {
  DECISION_REASON,
  DECISION_VALIDITY_MINUTES,
  type DecisionReasonCode,
  type DecisionRecord,
  type DecisionRequest,
  type DecisionResponse,
  type RecordedRiskAssessment,
  type RiskAssessment,
} from '@sentinel/domain';
import { extractRiskFeatures } from '@sentinel/rules';
import type { TraceId } from '../../../platform/correlation/trace-id.js';
import { ApplicationError } from '../../../platform/errors/application-error.js';
import type { IdGenerator } from '../../../platform/ids/id-generator.js';
import type { Clock } from '../../../platform/time/clock.js';
import type { ComputeRollingWindow } from '../../accounts/application/compute-rolling-window.use-case.js';
import type { AccountRepository } from '../../accounts/application/ports/account-repository.port.js';
import type { AccountSecurityStateRepository } from '../../accounts/application/ports/account-security-state-repository.port.js';
import type { RaiseAlert } from '../../alerts/application/raise-alert.use-case.js';
import type { InterventionWorkflow } from '../../interventions/application/intervention-workflow.use-case.js';
import type { EvaluateRapidDrainGate, RapidDrainGateOutcome } from '../../policy/application/evaluate-rapid-drain-gate.use-case.js';
import type { AssessTransactionRisk } from '../../risk/application/assess-transaction-risk.use-case.js';
import type { EntityLinkSource } from '../../risk/application/ports/entity-link-source.port.js';
import type { ApplyTransactionLifecycleEvent } from '../../transactions/application/apply-transaction-lifecycle-event.use-case.js';
import { transactionFromEvent } from '../../transactions/application/transaction-from-event.js';
import type { DecideTransaction } from './decide-transaction.use-case.js';
import { toDecisionResponse } from './decision-response.mapper.js';
import type { DecisionRepository } from './ports/decision-repository.port.js';

export interface DecisionServiceDependencies {
  readonly decisions: DecisionRepository;
  readonly accounts: AccountRepository;
  readonly securityStates: AccountSecurityStateRepository;
  readonly entityLinks: EntityLinkSource;
  readonly rollingWindow: ComputeRollingWindow;
  readonly rapidDrainGate: EvaluateRapidDrainGate;
  readonly riskAssessment: AssessTransactionRisk;
  readonly transactionLifecycle: ApplyTransactionLifecycleEvent;
  readonly interventions: InterventionWorkflow;
  readonly alerts: RaiseAlert;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

const VALIDITY_MS = DECISION_VALIDITY_MINUTES * 60_000;

function reasonFor(gate: RapidDrainGateOutcome): DecisionReasonCode {
  if (gate.drain.excluded) return DECISION_REASON.excluded;
  if (!gate.protected) return DECISION_REASON.notProtected;
  return gate.drain.thresholdMet ? DECISION_REASON.thresholdExceeded : DECISION_REASON.gateNotMet;
}

function withoutRecordFields({ assessmentId, accountId, rulesetVersion, ...assessment }: RecordedRiskAssessment): RiskAssessment {
  return assessment;
}

/**
 * The synchronous control path: idempotency, rolling window, drain gate, features, risk assessment, initial
 * PENDING projection, decision record, hold, alert. Never waits on Pub/Sub; no language model anywhere.
 */
export class DecisionService implements DecideTransaction {
  constructor(private readonly dependencies: DecisionServiceDependencies) {}

  async decide(request: DecisionRequest, traceId: TraceId): Promise<DecisionResponse> {
    const deps = this.dependencies;
    const stored = await deps.decisions.findByIdempotencyKey(request.idempotencyKey);
    if (stored) return toDecisionResponse(stored);

    const account = await deps.accounts.findAccount(request.sourceAccountToken);
    if (!account) {
      throw new ApplicationError('UNPROCESSABLE', `Account ${request.sourceAccountToken} is unknown; the bank must report it first`);
    }

    const transaction = transactionFromEvent(request);
    const evaluatedAt = request.occurredAt;
    const window = await deps.rollingWindow.windowFor(account, evaluatedAt, transaction.id);
    const gate = deps.rapidDrainGate.evaluate(transaction, window);
    const [securityState, flaggedLinks] = await Promise.all([
      deps.securityStates.findSecurityState(account.id),
      deps.entityLinks.flaggedLinksFor(request.destinationAccountToken),
    ]);
    const features = extractRiskFeatures({
      deviceToken: request.deviceToken ?? null,
      payeeToken: transaction.payeeId,
      account,
      securityState,
      flaggedLinks,
      evaluatedAt,
    });
    const assessment = await deps.riskAssessment.assessAndRecord(
      transaction,
      { ...account, protected: gate.protected },
      { ...window, drain: gate.drain, features },
    );
    await deps.transactionLifecycle.apply(request, { drainExcluded: gate.drain.excluded });

    const decidedAt = deps.clock.now();
    const hold = gate.drain.thresholdMet;
    const record: DecisionRecord = {
      decisionId: deps.ids.next(),
      tenantId: request.tenantId,
      transactionId: request.transactionId,
      idempotencyKey: request.idempotencyKey,
      decision: hold ? 'HOLD' : 'ALLOW',
      riskScore: assessment.score,
      policyCodes: hold ? ['RAPID_DRAIN'] : [],
      reasonCodes: [reasonFor(gate)],
      assessmentId: assessment.assessmentId,
      rulesetVersion: assessment.rulesetVersion,
      policyVersion: gate.policy.policyVersion,
      ...(hold ? { holdUntil: deps.rapidDrainGate.holdUntil(decidedAt) } : {}),
      decidedAt: decidedAt.toISOString(),
      expiresAt: new Date(decidedAt.getTime() + VALIDITY_MS).toISOString(),
      traceId,
      accountId: account.id,
      ...(account.displayReference ? { accountReference: account.displayReference } : {}),
      institutionId: transaction.institutionId,
      destinationInstitutionId: transaction.destInstitutionId,
      amount: transaction.amount,
      band: assessment.band,
      occurredAt: evaluatedAt,
      assessment: withoutRecordFields(assessment),
    };

    const written = await deps.decisions.record(record);
    if (written.outcome === 'DUPLICATE') return toDecisionResponse(written.record);
    if (hold) await deps.interventions.placeHold(record);
    await deps.alerts.raiseFor(record);
    return toDecisionResponse(record);
  }
}
