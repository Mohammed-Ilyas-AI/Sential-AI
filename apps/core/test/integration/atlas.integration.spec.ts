import { DEMO_TAKEOVER_01, type AdvisoryOutcome, type DecisionResponse, type InvestigationEvidence, type RiskExplanation } from '@sentinel/domain';
import { INSTANT_TIMELINE, buildDemoTakeover01, playScenario, syntheticToken } from '@sentinel/scenarios';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { composeMongoPersistence } from '../../src/composition/mongo-persistence.composition.js';
import { connectMongo, type MongoConnection } from '../../src/infrastructure/database/mongodb/client/mongo-connection.js';
import { SENTINEL_COLLECTIONS } from '../../src/infrastructure/database/mongodb/collections/sentinel-collections.js';
import { ensureSentinelDatabase, type DatabaseSetupReport } from '../../src/infrastructure/database/mongodb/indexes/ensure-sentinel-database.js';
import { MongoAccountStateRepository } from '../../src/infrastructure/database/mongodb/repositories/mongo-account-state.repository.js';
import { MongoAlertRepository } from '../../src/infrastructure/database/mongodb/repositories/mongo-alert.repository.js';
import { MongoAssessmentRepository } from '../../src/infrastructure/database/mongodb/repositories/mongo-assessment.repository.js';
import { MongoDecisionRepository } from '../../src/infrastructure/database/mongodb/repositories/mongo-decision.repository.js';
import { MongoEntityLinkSource } from '../../src/infrastructure/database/mongodb/repositories/mongo-entity-link.source.js';
import { MongoGraphRepository } from '../../src/infrastructure/database/mongodb/repositories/mongo-graph.repository.js';
import { MongoInterventionRepository } from '../../src/infrastructure/database/mongodb/repositories/mongo-intervention.repository.js';
import { MongoOutflowWindowSource } from '../../src/infrastructure/database/mongodb/repositories/mongo-outflow-window.source.js';
import { MongoSecurityEventLog } from '../../src/infrastructure/database/mongodb/repositories/mongo-security-event.log.js';
import { MongoTransactionEventLog } from '../../src/infrastructure/database/mongodb/repositories/mongo-transaction-event.log.js';
import { MongoTransactionProjectionRepository } from '../../src/infrastructure/database/mongodb/repositories/mongo-transaction-projection.repository.js';
import { describeAccountStateContract } from '../contracts/account-state.contract.js';
import { describeDecisionRepositoryContract } from '../contracts/decision-repository.contract.js';
import { describeInterventionRepositoryContract } from '../contracts/intervention-repository.contract.js';
import { describeNetworkGraphContract } from '../contracts/network-graph.contract.js';
import { describeRecordStoresContract } from '../contracts/record-stores.contract.js';
import { describeTransactionStoreContract } from '../contracts/transaction-store.contract.js';
import { startCoreHarness } from '../support/harness/core-test-harness.js';
import { HttpBankConnector, callJson } from '../support/harness/http-bank-connector.js';
import { DOCUMENTED_SCORES, FIRST_EPOCH, outflowInWindow, playTwoRunsAndAReplay, scriptedTransfers, victimOf } from '../support/scenario/repeat-runs.js';
import { ATLAS_URI, INTEGRATION_DATABASE } from './atlas-environment.js';

const describeAgainstAtlas = ATLAS_URI ? describe : describe.skip;

describeAgainstAtlas(`MongoDB Atlas integration (throwaway database ${INTEGRATION_DATABASE})`, () => {
  let connection: MongoConnection;
  let setup: DatabaseSetupReport;

  beforeAll(async () => {
    connection = await connectMongo({ uri: ATLAS_URI ?? '', database: INTEGRATION_DATABASE }, 'sentinel-core-integration');
    setup = await ensureSentinelDatabase(connection.database);
  });

  afterAll(async () => {
    await connection?.database.dropDatabase();
    await connection?.close();
  });

  const clean = async () => {
    await Promise.all(SENTINEL_COLLECTIONS.map((collection) => connection.database.collection(collection.name).deleteMany({})));
    return connection.database;
  };

  describe('preflight', () => {
    it('connects, authenticates and reaches the database', async () => {
      expect(await connection.database.command({ ping: 1 })).toMatchObject({ ok: 1 });
    });

    it('runs on a replica set, so change streams are available', async () => {
      const hello = await connection.database.admin().command({ hello: 1 });
      expect(typeof hello['setName'] === 'string' || hello['msg'] === 'isdbgrid').toBe(true);
    });

    it('creates all eleven collections and every documented index', async () => {
      expect([...setup.createdCollections].sort()).toEqual(SENTINEL_COLLECTIONS.map((collection) => collection.name).sort());
      const expectedIndexes = SENTINEL_COLLECTIONS.flatMap((collection) => collection.indexes.map((index) => `${collection.name}.${index.name}`));
      expect([...setup.ensuredIndexes].sort()).toEqual(expectedIndexes.sort());
    });

    it('re-runs the setup idempotently', async () => {
      const again = await ensureSentinelDatabase(connection.database);
      expect(again.createdCollections).toEqual([]);
    });
  });

  describeDecisionRepositoryContract('MongoDB Atlas', async () => new MongoDecisionRepository(await clean()));
  describeInterventionRepositoryContract('MongoDB Atlas', async () => new MongoInterventionRepository(await clean()));
  describeTransactionStoreContract('MongoDB Atlas', async () => {
    const database = await clean();
    return {
      events: new MongoTransactionEventLog(database),
      projections: new MongoTransactionProjectionRepository(database),
      outflows: new MongoOutflowWindowSource(database),
    };
  });
  describeAccountStateContract('MongoDB Atlas', async () => new MongoAccountStateRepository(await clean()));
  describeRecordStoresContract('MongoDB Atlas', async () => {
    const database = await clean();
    return {
      assessments: new MongoAssessmentRepository(database),
      alerts: new MongoAlertRepository(database),
      securityEvents: new MongoSecurityEventLog(database),
    };
  });
  describeNetworkGraphContract('MongoDB Atlas', async () => {
    const database = await clean();
    return { graph: new MongoGraphRepository(database), entityLinks: new MongoEntityLinkSource(database) };
  });

  describe('API smoke: DEMO_TAKEOVER_01 over HTTP against Atlas', () => {
    it('reproduces the documented final state', { timeout: 600_000 }, async () => {
      const database = await clean();
      const epoch = '2026-09-24T11:30:00.000Z';
      const explanation = { primaryReason: 'A 65.4% drain followed a new device and a new payee', recommendedAction: 'Contact the customer' };
      const modelGateway = { generate: async () => JSON.stringify(explanation) };
      const harness = await startCoreHarness(composeMongoPersistence(database), { clockStart: epoch, modelGateway });
      try {
        const playback = await playScenario(buildDemoTakeover01(epoch), new HttpBankConnector(harness.baseUrl, harness.clock), INSTANT_TIMELINE);
        const victim = syntheticToken('acct', DEMO_TAKEOVER_01.accountDisplayId);
        const scripted = playback.transfers.filter((transfer) => transfer.step.request.sourceAccountToken === victim).slice(1);
        expect(playback.securityReceipts.slice(0, 2).map((receipt) => receipt.posture.score)).toEqual([21, 37]);
        expect(scripted.map((transfer) => transfer.response.riskScore)).toEqual([37, 49, 75, 95]);
        expect(scripted.map((transfer) => transfer.response.decision)).toEqual(['ALLOW', 'ALLOW', 'ALLOW', 'HOLD']);

        const finalRecord = await database.collection('decisions').findOne({ transactionId: scripted.at(-1)?.response.transactionId });
        expect(finalRecord?.['assessment']?.drain).toMatchObject({ balanceAtWindowStart: 5_200_000, outflow24h: 3_400_000, thresholdMet: true });
        expect(await database.collection('interventions').countDocuments({ state: 'HELD' })).toBe(1);
        expect(await database.collection('alerts').findOne({ accountId: victim })).toMatchObject({ band: 'CRITICAL', onHold: true });

        // The evidence bundle, read from Atlas by MongoEvidenceSource.
        const final = scripted.at(-1);
        const assessmentId = final?.response.assessmentId ?? '';
        const { body: opened } = await callJson<InvestigationEvidence>(harness.baseUrl, 'GET', `/v1/investigations/${assessmentId}/evidence`);
        expect(Object.fromEntries(opened.evidence.assessment.contributions.map((contribution) => [contribution.code, contribution.points]))).toEqual(
          DEMO_TAKEOVER_01.finalContributions,
        );
        expect(opened.evidence.account).toMatchObject({ accountId: victim, protected: true });
        expect(opened.evidence.interventions.map((intervention) => intervention.state)).toEqual(['HELD']);

        // MongoExplanationCache writes the explanation beside contributions[], never into them.
        const explain = () => callJson<AdvisoryOutcome<RiskExplanation>>(harness.baseUrl, 'POST', `/v1/investigations/${assessmentId}/explanation`);
        expect((await explain()).body).toMatchObject({ status: 'GENERATED', attempts: 1 });
        expect((await explain()).body).toMatchObject({ status: 'CACHED', attempts: 0, advisory: explanation });
        const stored = await database.collection('assessments').findOne({ _id: assessmentId as never });
        expect(stored?.['explanation']).toMatchObject(explanation);
        expect(stored?.['contributions']).toEqual(opened.evidence.assessment.contributions);

        // The hold cascade reads the account's interventions from Atlas.
        const request = final?.step.request;
        if (!request) throw new Error('The final transfer was not played');
        harness.clock.set(new Date(Date.parse(request.occurredAt) + 60_000).toISOString());
        const { body: followOn } = await callJson<DecisionResponse>(harness.baseUrl, 'POST', '/v1/decision/transactions', {
          ...request,
          transactionId: `${request.transactionId}-FOLLOW-ON`,
          eventId: `${request.eventId}-FOLLOW-ON`,
          idempotencyKey: `${request.idempotencyKey}-FOLLOW-ON`,
          accountSequence: request.accountSequence + 100,
          amount: 100,
          occurredAt: harness.clock.now().toISOString(),
        });
        expect(followOn.decision).toBe('HOLD');
        expect(await database.collection('interventions').countDocuments({ accountId: victim, state: 'HELD' })).toBe(2);
      } finally {
        await harness.close();
      }
    });
  });

  describe('Demo repeatability: two runs and an exact replay against Atlas', () => {
    it('scores both runs as documented, counts each once, and stores nothing new on the replay', { timeout: 600_000 }, async () => {
      const database = await clean();
      const persistence = composeMongoPersistence(database);
      const harness = await startCoreHarness(persistence, { clockStart: FIRST_EPOCH });
      try {
        const result = await playTwoRunsAndAReplay(harness);
        for (const [report, runId] of [[result.first, 'RUNA'], [result.second, 'RUNB']] as const) {
          expect(scriptedTransfers(report, runId).map((transfer) => transfer.response.riskScore)).toEqual(DOCUMENTED_SCORES);
          expect(await outflowInWindow(persistence, report, runId)).toBe(DEMO_TAKEOVER_01.totalMovedInWindow);
          expect(await database.collection('interventions').countDocuments({ accountId: victimOf(runId) })).toBe(1);
        }
        const decisionsPerRun = result.first.transfers.length;
        expect(await database.collection('decisions').countDocuments()).toBe(decisionsPerRun * 2);
        expect(await database.collection('security_events').countDocuments()).toBe(result.first.securityReceipts.length * 2);
        expect(result.replay.transfers.map((transfer) => transfer.response.decisionId)).toEqual(result.first.transfers.map((transfer) => transfer.response.decisionId));
      } finally {
        await harness.close();
      }
    });
  });
});
