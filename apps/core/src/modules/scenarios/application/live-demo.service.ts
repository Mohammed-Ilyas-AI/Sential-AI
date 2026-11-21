import {
  DEMO_TAKEOVER_01,
  REFERENCE_SCENARIOS,
  runAccountReference,
  type DecisionResponse,
  type LiveDemoHold,
  type LiveDemoReport,
  type MultiScamBurstCase,
  type MultiScamBurstReport,
} from '@sentinel/domain';
import { bandFor } from '@sentinel/rules';
import {
  buildDemoTakeover01,
  buildMultiScamBurst01,
  newScenarioRunId,
  playScenario,
  ScenarioEventFactory,
  SYNTHETIC_ACCOUNTS,
  type BankConnector,
  type MultiScamBurstCaseScenario,
  type PlayedTransfer,
  type ScenarioRunId,
  type ScenarioTimeline,
} from '@sentinel/scenarios';

import { ApplicationError } from '../../../platform/errors/application-error.js';
import type { Clock } from '../../../platform/time/clock.js';
import type { ActingContext, AuditTrail } from '../../audit/application/audit-trail.js';
import type { CaseSwarm } from './ports/case-swarm.port.js';

const holdOf = ({ step, response }: PlayedTransfer): LiveDemoHold => ({
  transactionId: response.transactionId,
  assessmentId: response.assessmentId,
  accountId: step.request.sourceAccountToken,
  amount: step.request.amount,
  riskScore: response.riskScore,
  ...(response.holdUntil ? { holdUntil: response.holdUntil } : {}),
});

/** The attacker's next attempt after the case is worked: same new device, same mule payee, S$9,800. */
const FOLLOW_UP_AMOUNT = 980_000;
const FOLLOW_UP_PAYEE = 'PAYEE-7742';

/**
 * The in-app live demo (M§6): DEMO_TAKEOVER_01 played through sentinel-core's own control path, in-process and
 * within the request that started it, so it needs no job, child process or extra cloud resource. Each run is new
 * activity on run-scoped synthetic accounts. One run at a time per instance; the rules decide every transfer.
 */
export class LiveDemoService {
  private running: Promise<unknown> | null = null;
  private lastRunId: ScenarioRunId | null = null;
  private followUps = 0;

  constructor(
    private readonly bank: BankConnector,
    private readonly timeline: () => ScenarioTimeline,
    private readonly audit: AuditTrail,
    private readonly clock: Clock,
    private readonly swarm?: CaseSwarm,
  ) {}

  async run(context: ActingContext): Promise<LiveDemoReport> {
    return this.exclusively(context, () => this.play(context));
  }

  /**
   * MULTI_SCAM_BURST_01: the reference's four scenarios on all three banks at once. Each case is played on its
   * own, concurrently with the others, through the same control path a bank calls; within a case the steps keep
   * their order. The rules decide every transfer. Then each case's evidence bundle is compiled and, for every case
   * the gate held or scored HIGH or CRITICAL, the 7-agent swarm works it. Shares the one-run-at-a-time guard.
   */
  async runBurst(context: ActingContext): Promise<MultiScamBurstReport> {
    return this.exclusively(context, () => this.playBurst(context));
  }

  private async exclusively<T>(context: ActingContext, play: () => Promise<T>): Promise<T> {
    if (context.actor !== 'ANALYST' || !context.actorIdentity?.trim()) throw new ApplicationError('UNPROCESSABLE', 'An analyst identity is required');
    if (this.running) throw new ApplicationError('CONFLICT', 'A live demo is already running; wait for it to finish');
    const run = play().finally(() => {
      this.running = null;
    });
    this.running = run;
    return run;
  }

  private async playBurst(context: ActingContext): Promise<MultiScamBurstReport> {
    const started = this.clock.now();
    const runId = newScenarioRunId(started.getTime());
    await this.audit.record(context, {
      category: 'SCENARIO',
      action: 'MULTI_SCAM_BURST_STARTED',
      outcome: 'SUCCEEDED',
      subject: { runId },
      detail: 'MULTI_SCAM_BURST_01 in-process (synthetic): 4 reference scenarios x 3 banks, concurrent',
    });
    const burst = buildMultiScamBurst01(started.toISOString(), { runId });
    const timeline = this.timeline();
    const played = await Promise.all(
      burst.cases.map(async (entry) => ({ entry, report: await playScenario({ ...burst.scenario, timeline: entry.timeline }, this.bank, timeline) })),
    );
    const cases = await Promise.all(played.map(({ entry, report }) => this.describeCase(entry, report.transfers, context, runId)));
    return {
      runId,
      scenarioId: 'MULTI_SCAM_BURST_01',
      startedAt: started.toISOString(),
      finishedAt: this.clock.now().toISOString(),
      transfers: played.reduce((sum, { report }) => sum + report.transfers.length, 0),
      cases,
    };
  }

  private async describeCase(entry: MultiScamBurstCaseScenario, transfers: readonly PlayedTransfer[], context: ActingContext, runId: string): Promise<MultiScamBurstCase> {
    const held = transfers.filter(({ response }) => response.decision === 'HOLD').map(holdOf);
    const peak = transfers.reduce<PlayedTransfer | null>((best, transfer) => (!best || transfer.response.riskScore >= best.response.riskScore ? transfer : best), null);
    if (!peak) throw new Error(`Burst case ${entry.spec.accountDisplayId} played no transfer`);
    const assessmentId = peak.response.assessmentId;
    const evidence = this.swarm ? (await this.swarm.evidence(assessmentId, context)).evidence : null;
    const peakBand = evidence?.assessment.band ?? bandFor(peak.response.riskScore);
    const worked = held.length > 0 || peakBand === 'HIGH' || peakBand === 'CRITICAL';
    const swarm = worked && this.swarm ? await this.swarm.orchestrateSwarm(assessmentId, context) : undefined;
    return {
      scenario: entry.spec.scenario,
      scenarioName: REFERENCE_SCENARIOS[entry.spec.scenario].name,
      institutionId: entry.spec.institutionId,
      accountDisplayId: runAccountReference(entry.spec.accountDisplayId, runId),
      accountId: peak.step.request.sourceAccountToken,
      transfers: transfers.length,
      decision: held.length > 0 ? 'HOLD' : 'ALLOW',
      peakScore: peak.response.riskScore,
      peakBand,
      assessmentId,
      drainPct: evidence ? Number(evidence.drain.drainPct.toFixed(1)) : 0,
      held,
      ...(swarm ? { swarm } : {}),
    };
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
    const held = report.transfers.filter((transfer) => transfer.response.decision === 'HOLD').map(holdOf);
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
