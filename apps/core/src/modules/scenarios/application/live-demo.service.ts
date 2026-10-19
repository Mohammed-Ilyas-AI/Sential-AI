import type { LiveDemoReport } from '@sentinel/domain';
import { buildDemoTakeover01, newScenarioRunId, playScenario, type BankConnector, type ScenarioTimeline } from '@sentinel/scenarios';
import { ApplicationError } from '../../../platform/errors/application-error.js';
import type { Clock } from '../../../platform/time/clock.js';
import type { ActingContext, AuditTrail } from '../../audit/application/audit-trail.js';

/**
 * The in-app live demo (M§6): DEMO_TAKEOVER_01 played through sentinel-core's own control path, in-process and
 * within the request that started it, so it needs no job, child process or extra cloud resource. Each run is new
 * activity on run-scoped synthetic accounts. One run at a time per instance; the rules decide every transfer.
 */
export class LiveDemoService {
  private running: Promise<LiveDemoReport> | null = null;

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
}
