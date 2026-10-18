import { buildDemoTakeover01, buildSeededNoiseScenario, INSTANT_TIMELINE, newScenarioRunId, playScenario } from '@sentinel/scenarios';
import { HttpBankReportingClient } from './bank-reporting/bank-reporting.client.js';
import { loadSimulatorRuntimeConfig } from './configuration/simulator-config.js';
import { CoreHttpClient } from './decision-api/core-http.client.js';
import { HttpDecisionApiClient } from './decision-api/decision-api.client.js';
import { DirectPushTransactionEventPublisher } from './pubsub-publisher/direct-push-transaction-event.publisher.js';
import { PubSubTransactionEventPublisher } from './pubsub-publisher/pubsub-transaction-event.publisher.js';
import type { TransactionEventPublisher } from './pubsub-publisher/transaction-event.publisher.js';
import { SimulatorBankConnector } from './scenario-runner/simulator-bank-connector.js';
import { HttpSecurityEventApiClient } from './security-event-api/security-event-api.client.js';
import { createLogger } from './telemetry/logger.js';
import { RealTimeScenarioTimeline } from './timeline/real-time-scenario-timeline.js';

const config = loadSimulatorRuntimeConfig(process.env);
const logger = createLogger(config.logLevel);
if (config.scenarioId !== 'DEMO_TAKEOVER_01') throw new Error(`Unknown scenario ${config.scenarioId}`);

const core = new CoreHttpClient(config.coreBaseUrl);
const lifecycle: TransactionEventPublisher =
  config.transport.kind === 'pubsub'
    ? PubSubTransactionEventPublisher.forTopic(config.transport.projectId, config.transport.topic)
    : new DirectPushTransactionEventPublisher(config.transport.pushEndpoint);
const bank = new SimulatorBankConnector(new HttpBankReportingClient(core), new HttpSecurityEventApiClient(core), new HttpDecisionApiClient(core), lifecycle);

// Each start is a new run with its own identifiers, so a repeat demo is new activity, not a replay of stored
// events; SIMULATOR_RUN_ID replays one run exactly, and the core deduplicates every event in it.
const runId = config.runId ?? newScenarioRunId(Date.now());
const scenario = buildDemoTakeover01(new Date().toISOString(), { runId });
logger.info({ scenarioId: scenario.id, runId, steps: scenario.timeline.length, transport: config.transport.kind, timeline: config.timeline }, 'scenario starting');

try {
  const report = await playScenario(scenario, bank, config.timeline === 'instant' ? INSTANT_TIMELINE : new RealTimeScenarioTimeline(), (step) => {
    if (step.action !== 'REPORT_ACCOUNT' && step.atMs >= 30_000) logger.info({ atMs: step.atMs, action: step.action }, 'step');
  });
  const held = report.transfers.filter((transfer) => transfer.response.decision === 'HOLD');
  logger.info(
    { runId, transfers: report.transfers.length, held: held.map((transfer) => ({ transactionId: transfer.response.transactionId, riskScore: transfer.response.riskScore })) },
    'scenario complete',
  );
  if (config.noise.enabled) {
    const noiseRunId = newScenarioRunId(Date.now());
    const noise = buildSeededNoiseScenario(new Date().toISOString(), config.noise.seed, noiseRunId, config.noise.ratePerMinute);
    const noiseTimeline = config.timeline === 'instant' ? INSTANT_TIMELINE : new RealTimeScenarioTimeline();
    const noiseReport = await playScenario(noise, bank, noiseTimeline);
    logger.info(
      { scenarioId: noise.id, runId: noise.runId, seed: noise.seed, ratePerMinute: config.noise.ratePerMinute, transfers: noiseReport.transfers.length },
      'isolated synthetic background noise complete',
    );
  }
} finally {
  await lifecycle.close();
}
