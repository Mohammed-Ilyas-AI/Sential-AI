import { DEMO_TAKEOVER_01, type AdvisoryOutcome, type CustomerOutreachProposal, type CaseSummary, type EvidenceBundle, type InvestigationEvidence, type ModelJob, type RiskExplanation } from '@sentinel/domain';
import { INSTANT_TIMELINE, buildDemoTakeover01, playScenario, syntheticToken, type PlaybackReport } from '@sentinel/scenarios';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ModelGateway } from '../../src/modules/intelligence/application/ports/model-gateway.port.js';
import { ModelUnavailableError } from '../../src/modules/intelligence/application/ports/model-gateway.port.js';
import { startCoreHarness, type CoreHarness } from '../support/harness/core-test-harness.js';
import { HttpBankConnector, callJson } from '../support/harness/http-bank-connector.js';
import { createInMemoryPersistence, type InMemoryPersistence } from '../support/in-memory-repositories/in-memory-persistence.js';

const EPOCH = '2026-09-24T11:30:00.000Z';
const VICTIM = syntheticToken('acct', DEMO_TAKEOVER_01.accountDisplayId);

/** Stands in for Vertex AI: replays a script and records exactly what it was sent. */
class ScriptedModel implements ModelGateway {
  script: unknown[] = [];
  readonly calls: { job: ModelJob; evidence: EvidenceBundle }[] = [];
  async generate(job: ModelJob, evidence: EvidenceBundle): Promise<unknown> {
    this.calls.push({ job, evidence });
    const next = this.script.shift();
    if (next instanceof Error) throw next;
    return typeof next === 'string' ? next : JSON.stringify(next);
  }
}

/**
 * The intelligence path over real HTTP on DEMO_TAKEOVER_01 (T§7). The model is scripted, so these tests prove
 * what the server does with any answer; they are not evidence that Vertex AI was called.
 */
describe('/v1/investigations — evidence-grounded advisory on DEMO_TAKEOVER_01', () => {
  let persistence: InMemoryPersistence;
  let harness: CoreHarness;
  let playback: PlaybackReport;
  const model = new ScriptedModel();

  beforeAll(async () => {
    persistence = createInMemoryPersistence();
    harness = await startCoreHarness(persistence, { clockStart: EPOCH, modelGateway: model });
    playback = await playScenario(buildDemoTakeover01(EPOCH), new HttpBankConnector(harness.baseUrl, harness.clock), INSTANT_TIMELINE);
  });
  afterAll(() => harness.close());
  beforeEach(() => {
    model.script = [];
    model.calls.length = 0;
  });

  const finalAssessmentId = () => {
    const final = playback.transfers.filter((transfer) => transfer.step.request.sourceAccountToken === VICTIM).at(-1);
    if (!final) throw new Error('The final transfer was not played');
    return final.response.assessmentId;
  };
  const post = <TAdvisory>(path: string) => callJson<AdvisoryOutcome<TAdvisory>>(harness.baseUrl, 'POST', `/v1/investigations/${finalAssessmentId()}/${path}`);

  it('compiles the bundle from what the control path recorded: exact contributions, the drain, no display reference', async () => {
    const { status, body } = await callJson<InvestigationEvidence>(harness.baseUrl, 'GET', `/v1/investigations/${finalAssessmentId()}/evidence`);
    expect(status).toBe(200);
    const { evidence } = body;
    expect(Object.fromEntries(evidence.assessment.contributions.map((contribution) => [contribution.code, contribution.points]))).toEqual(
      DEMO_TAKEOVER_01.finalContributions,
    );
    expect(evidence.assessment.score).toBe(DEMO_TAKEOVER_01.finalScore);
    expect(evidence.drain).toMatchObject({ balanceAtWindowStart: DEMO_TAKEOVER_01.openingBalance, outflow24h: DEMO_TAKEOVER_01.totalMovedInWindow, thresholdMet: true });
    expect(evidence.account).toEqual({ accountId: VICTIM, institutionId: expect.any(String), openedAt: expect.any(String), protected: true });
    expect(evidence.recentTransactions.length).toBeGreaterThanOrEqual(5);
    expect(evidence.recentTransactions.length).toBeLessThanOrEqual(50);
    expect(evidence.deviceHistory.length + evidence.payeeHistory.length).toBeGreaterThanOrEqual(2);
    expect(evidence.interventions.map((intervention) => intervention.state)).toEqual(['HELD']);
    expect(JSON.stringify(evidence)).not.toContain(DEMO_TAKEOVER_01.accountDisplayId);
  });

  it('drafts the customer outreach with Gemini, and sends fixed wording when the draft is unsafe or Gemini is down', async () => {
    const outreach = () => callJson<CustomerOutreachProposal>(harness.baseUrl, 'POST', `/v1/investigations/${finalAssessmentId()}/customer-outreach`);
    const drafted = { subject: 'We paused a transfer from your account', emailBody: 'We paused a transfer of S$11,500.00. Please call the number on your card.', callScript: 'This is your bank. Please call the number on your card.' };
    model.script = [drafted];
    const gemini = await outreach();
    expect(gemini.status).toBe(200);
    expect(gemini.body).toMatchObject({ source: 'GEMINI', draft: drafted });
    expect(model.calls.map((call) => call.job)).toEqual(['CUSTOMER_OUTREACH']);

    model.script = [
      { ...drafted, emailBody: 'Verify at https://example.test/login with your OTP.' },
      { ...drafted, callScript: 'Your transfer will be released shortly.' },
    ];
    const unsafe = await outreach();
    expect(unsafe.body.source).toBe('TEMPLATE');
    expect(unsafe.body.model).toMatchObject({ status: 'FALLBACK', reason: 'INVALID_RESPONSE' });
    expect(unsafe.body.draft.emailBody).toContain('S$11,500.00');
    expect(unsafe.body.draft.emailBody).not.toMatch(/https?:/);

    model.script = [new ModelUnavailableError('NOT_CONFIGURED', 'no model')];
    expect((await outreach()).body).toMatchObject({ source: 'TEMPLATE', model: { reason: 'MODEL_NOT_CONFIGURED' } });
  });

  it('answers 404 for an assessment that does not exist', async () => {
    expect((await callJson(harness.baseUrl, 'GET', '/v1/investigations/no-such-assessment/evidence')).status).toBe(404);
  });

  it('denies a different bank lens before returning evidence or invoking the advisor', async () => {
    const assessmentId = finalAssessmentId();
    const lens = { 'x-sentinel-lens': 'BANK_B' };
    const evidence = await callJson(harness.baseUrl, 'GET', `/v1/investigations/${assessmentId}/evidence`, undefined, lens);
    const summary = await callJson(harness.baseUrl, 'POST', `/v1/investigations/${assessmentId}/case-summary`, {}, lens);
    expect(evidence.status).toBe(403);
    expect(summary.status).toBe(403);
    expect(model.calls).toHaveLength(0);
    expect(persistence.auditLog.all()).toContainEqual(
      expect.objectContaining({
        action: 'CROSS_TENANT_DENIED',
        outcome: 'DENIED',
        subject: expect.objectContaining({ accountId: VICTIM, institutionId: 'BANK_A' }),
      }),
    );
  });

  it('returns a grounded case summary and drops the claim that cites a field the bundle does not have', async () => {
    model.script = [
      {
        hypothesis: 'Probable account takeover: a new device and new payee preceded a 65.4% drain of a protected balance.',
        confidence: 'HIGH',
        evidence: [
          { claim: 'The drain crossed SG-RD-50', sourceField: 'drain.thresholdMet', value: 'true' },
          { claim: 'Rapid drain is the largest contribution', sourceField: 'assessment.contributions[0].points', value: '30' },
          { claim: 'The customer reported a scam call', sourceField: 'customer.callNotes', value: 'scam call' },
        ],
        recommendedActions: ['Contact the customer through the number on file'],
        escalate: true,
      },
    ];
    const { status, body } = await post<CaseSummary>('case-summary');
    expect(status).toBe(200);
    expect(body).toMatchObject({ status: 'GENERATED', attempts: 1, droppedClaims: 1 });
    expect(body.advisory?.evidence.map((item) => item.sourceField)).toEqual(['drain.thresholdMet', 'assessment.contributions[0].points']);
    expect(model.calls.map((call) => call.job)).toEqual(['CASE_SUMMARY']);
    expect(model.calls[0]?.evidence.assessment.score).toBe(95);
    expect(await persistence.summaries.find(finalAssessmentId())).toMatchObject({
      assessmentId: finalAssessmentId(),
      summary: { hypothesis: 'Probable account takeover: a new device and new payee preceded a 65.4% drain of a protected balance.' },
    });
  });

  it('retries a schema-invalid response once, then falls back to the deterministic attribution', async () => {
    model.script = ['{"hypothesis": 42}', { hypothesis: 'h', confidence: 'SURE', evidence: [], recommendedActions: [], escalate: false }];
    const { status, body } = await post<CaseSummary>('case-summary');
    expect(status).toBe(200);
    expect(body).toEqual({ status: 'FALLBACK', advisory: null, reason: 'INVALID_RESPONSE', attempts: 2 });
  });

  it('rejects a recommendation to release the held transfer, whatever else it says', async () => {
    const releasing = { primaryReason: 'The payee is familiar', recommendedAction: 'Release the hold' };
    model.script = [releasing, releasing];
    expect((await post<RiskExplanation>('explanation')).body).toMatchObject({ status: 'FALLBACK', reason: 'INVALID_RESPONSE' });
  });

  it('falls back during an outage, and the hold and the score are exactly as before', async () => {
    model.script = [new ModelUnavailableError('TRANSIENT', 'HTTP 503'), new ModelUnavailableError('TRANSIENT', 'HTTP 503')];
    expect((await post<CaseSummary>('case-summary')).body).toMatchObject({ status: 'FALLBACK', reason: 'MODEL_UNAVAILABLE', attempts: 2 });
    const record = await persistence.decisions.findByIdempotencyKey(
      playback.transfers.filter((transfer) => transfer.step.request.sourceAccountToken === VICTIM).at(-1)?.step.request.idempotencyKey ?? '',
    );
    expect(record).toMatchObject({ decision: 'HOLD', riskScore: 95 });
    expect((await persistence.interventions.findByTransactionId(record?.transactionId ?? '')).map((intervention) => intervention.state)).toEqual(['HELD']);
  });

  it('explains on the fast job and keeps the hold and the score when the explanation falls back', async () => {
    model.script = [new ModelUnavailableError('TRANSIENT', 'HTTP 503'), new ModelUnavailableError('TRANSIENT', 'HTTP 503')];
    expect((await post<RiskExplanation>('explanation')).body).toMatchObject({ status: 'FALLBACK', reason: 'MODEL_UNAVAILABLE', attempts: 2 });
    expect(model.calls.map((call) => call.job)).toEqual(['RISK_EXPLANATION', 'RISK_EXPLANATION']);
    const record = await persistence.decisions.findByIdempotencyKey(
      playback.transfers.filter((transfer) => transfer.step.request.sourceAccountToken === VICTIM).at(-1)?.step.request.idempotencyKey ?? '',
    );
    expect(record).toMatchObject({ decision: 'HOLD', riskScore: 95 });
  });

  it('reports a call that reached the platform ceiling once, without retrying, and the decision is untouched', async () => {
    model.script = [new ModelUnavailableError('TIMED_OUT', 'ceiling'), { primaryReason: 'never used', recommendedAction: 'never used' }];
    expect((await post<RiskExplanation>('explanation')).body).toEqual({ status: 'FALLBACK', advisory: null, reason: 'MODEL_TIMED_OUT', attempts: 1 });
    expect(model.calls).toHaveLength(1);
    const record = await persistence.decisions.findByIdempotencyKey(
      playback.transfers.filter((transfer) => transfer.step.request.sourceAccountToken === VICTIM).at(-1)?.step.request.idempotencyKey ?? '',
    );
    expect(record).toMatchObject({ decision: 'HOLD', riskScore: 95 });
  });

  it('caches the explanation by assessmentId: the second request makes no model call', async () => {
    model.script = [{ primaryReason: 'A 65.4% drain followed a new device and a new payee', recommendedAction: 'Contact the customer before anything else' }];
    expect((await post<RiskExplanation>('explanation')).body).toMatchObject({ status: 'GENERATED', attempts: 1 });
    expect((await post<RiskExplanation>('explanation')).body).toMatchObject({ status: 'CACHED', attempts: 0, advisory: { assessmentId: finalAssessmentId() } });
    expect(model.calls).toHaveLength(1);
  });
});

describe('/v1/investigations — no model configured', () => {
  it('reports MODEL_NOT_CONFIGURED through the real Vertex gateway without any network call', async () => {
    const persistence = createInMemoryPersistence();
    const harness = await startCoreHarness(persistence, { clockStart: EPOCH });
    const playback = await playScenario(buildDemoTakeover01(EPOCH), new HttpBankConnector(harness.baseUrl, harness.clock), INSTANT_TIMELINE);
    const assessmentId = playback.transfers.at(-1)?.response.assessmentId ?? '';
    const { body } = await callJson<AdvisoryOutcome<CaseSummary>>(harness.baseUrl, 'POST', `/v1/investigations/${assessmentId}/case-summary`);
    expect(body).toEqual({ status: 'FALLBACK', advisory: null, reason: 'MODEL_NOT_CONFIGURED', attempts: 1 });
    await harness.close();
  });
});
