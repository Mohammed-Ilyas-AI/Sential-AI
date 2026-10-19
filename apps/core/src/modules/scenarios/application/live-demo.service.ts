import { DEMO_TAKEOVER_01, type DecisionResponse, type LiveDemoReport } from '@sentinel/domain';
import {
  buildDemoTakeover01,
  newScenarioRunId,
  playScenario,
  ScenarioEventFactory,
  SYNTHETIC_ACCOUNTS,
  type BankConnector,
  type ScenarioRunId,
  type ScenarioTimeline,
} from '@sentinel/scenarios';

import { ApplicationError } from '../../../platform/errors/application-error.js';
import type { Clock } from '../../../platform/time/clock.js';
import type { ActingContext, AuditTrail } from '../../audit/application/audit-trail.js';

/** The attacker's next attempt after the case is worked: same new device, same mule payee, S$9,800. */
const FOLLOW_UP_AMOUNT = 980_000;
const FOLLOW_UP_PAYEE = 'PAYEE-7742';

/**
 * The in-app live demo (M§6): DEMO_TAKEOVER_01 played through sentinel-core's own control path, in-process and
 * within the request that started it, so it needs no job, child process or extra cloud resource. Each run is new
 * activity on run-scoped synthetic accounts. One run at a time per instance; the rules decide every transfer.
 */
export class LiveDemoService {
  private running: Promise<LiveDemoReport> | null = null;
  private lastRunId: ScenarioRunId | null = null;
  private followUps = 0;

  constructor(
    private readonly bank: BankConnector,
    private readonly timeline: () => ScenarioTimeline,
    private readonly audit: AuditTrail,
    private readonly clock: Clock,
  ) {}

  async run(context: ActingContext): Promise<LiveDemoReport> {
    if (context.actor !== 'ANALYST' || !context.actorIdentity?.trim()) throw new ApplicationError('UNPROCESSABLE', 'An analyst identity is required');
    if (this.running) throw new ApplicationError('CONFLICT', 'A live demo is already running; wait for it to finish');
    const run = this.play(context).finally(() => {
      this.running = null;
    });
    this.running = run;
    return run;
  }

  private async play(context: ActingContext): Promise<LiveDemoReport> {
    const started = this.clock.now();
    const runId = newScenarioRunId(started.getTime());
    this.lastRunId = runId;
    this.followUps = 0;
    await this.audit.record(context, {
      category: 'SCENARIO',
      action: 'LIVE_DEMO_STARTED',
      outcome: 'SUCCEEDED',
      subject: { runId },
      detail: 'DEMO_TAKEOVER_01 in-process (synthetic)',
    });
    const report = await playScenario(buildDemoTakeover01(started.toISOString(), { runId }), this.bank, this.timeline());
    const held = report.transfers
      .filter((transfer) => transfer.response.decision === 'HOLD')
      .map(({ step, response }) => ({
        transactionId: response.transactionId,
        assessmentId: response.assessmentId,
        accountId: step.request.sourceAccountToken,
        amount: step.request.amount,
        riskScore: response.riskScore,
        ...(response.holdUntil ? { holdUntil: response.holdUntil } : {}),
      }));
    return {
      runId,
      scenarioId: 'DEMO_TAKEOVER_01',
      startedAt: started.toISOString(),
      finishedAt: this.clock.now().toISOString(),
      transfers: report.transfers.length,
      held,
    };
  }

  /**
   * The attacker tries again on the same run's synthetic victim, through the same gate. Whatever the gate decides is
   * the answer: after the kill switch it is a HOLD under KILL_SWITCH; nothing here forces it.
   */
  async attemptFollowUpTransfer(context: ActingContext, runId: string): Promise<DecisionResponse> {
    if (context.actor !== 'ANALYST' || !context.actorIdentity?.trim()) throw new ApplicationError('UNPROCESSABLE', 'An analyst identity is required');
    if (!this.lastRunId || runId !== this.lastRunId) throw new ApplicationError('NOT_FOUND', `No live demo run ${runId} on this instance`);
    const victim = SYNTHETIC_ACCOUNTS.find((account) => account.displayId === DEMO_TAKEOVER_01.accountDisplayId);
    if (!victim) throw new ApplicationError('CONFLICT', 'The demo account is missing from the synthetic roster');
    this.followUps += 1;
    const events = new ScenarioEventFactory(`DT01F${this.followUps}`, this.clock.now().getTime(), this.lastRunId);
    const { request } = events.transfer({
      source: victim,
      payeeId: FOLLOW_UP_PAYEE,
      destinationInstitutionId: 'BANK_C',
      amount: FOLLOW_UP_AMOUNT,
      deviceId: DEMO_TAKEOVER_01.newDeviceId,
      occurredAt: this.clock.now().toISOString(),
    });
    return this.bank.requestDecision(request);
  }
}
