import type { EvidenceBundle, ModelJob, RiskExplanation } from '@sentinel/domain';
import { describe, expect, it, vi } from 'vitest';
import { IntelligenceService } from './intelligence.service.js';
import type { ExplanationCache } from './ports/explanation-cache.port.js';
import { ModelUnavailableError, type ModelGateway } from './ports/model-gateway.port.js';
import { ResponseSchemaValidator } from './response-schema.validator.js';
import { SourceFieldValidator } from './source-field.validator.js';

const bundle = {
  account: { accountId: 'acct_tok_victim', institutionId: 'BANK_A', openedAt: '2019-01-01T00:00:00.000Z', protected: true },
  assessment: {
    transactionId: 'TX-1',
    score: 95,
    band: 'CRITICAL',
    contributions: [
      { code: 'RAPID_DRAIN', label: 'Rapid drain', points: 30 },
      { code: 'NEW_DEVICE', label: 'New device', points: 21 },
    ],
    drain: { balanceAtWindowStart: 5_200_000, outflow24h: 3_400_000, drainPct: 65.38, thresholdMet: true, excluded: false },
    evaluatedAt: '2026-09-24T11:31:00.000Z',
  },
  drain: { balanceAtWindowStart: 5_200_000, outflow24h: 3_400_000, drainPct: 65.38, thresholdMet: true, excluded: false },
  recentTransactions: [],
  deviceHistory: [],
  payeeHistory: [],
  priorAlerts: [],
  interventions: [],
  neighbourhood: { rootId: 'acct_tok_victim', hopDepth: 2, nodes: [], edges: [], truncated: false },
} as unknown as EvidenceBundle;

const grounded = {
  hypothesis: 'Account takeover: a new device and a new payee preceded a 65% drain of a protected balance.',
  confidence: 'HIGH',
  evidence: [
    { claim: 'The drain crossed the published threshold', sourceField: 'drain.drainPct', value: '65.38' },
    { claim: 'The largest contribution is the rapid drain', sourceField: 'assessment.contributions[0].points', value: 30 },
    { claim: 'The customer was phoned by the bank', sourceField: 'customer.phoneLog', value: 'called' },
  ],
  recommendedActions: ['Contact the customer on the number held on file', 'Do not release the hold before the customer verifies'],
  escalate: true,
};

class ScriptedModel implements ModelGateway {
  readonly jobs: ModelJob[] = [];
  constructor(private readonly script: unknown[]) {}
  async generate(job: ModelJob): Promise<unknown> {
    this.jobs.push(job);
    const next = this.script.shift();
    if (next instanceof Error) throw next;
    return next;
  }
}

class MemoryCache implements ExplanationCache {
  readonly stored: RiskExplanation[] = [];
  async find(assessmentId: string) {
    return this.stored.find((explanation) => explanation.assessmentId === assessmentId) ?? null;
  }
  async store(explanation: RiskExplanation) {
    this.stored.push(explanation);
  }
}

const serviceWith = (model: ModelGateway, explanations: ExplanationCache = new MemoryCache()) =>
  new IntelligenceService({
    modelGateway: model,
    explanations,
    responseSchemas: new ResponseSchemaValidator(),
    sourceFields: new SourceFieldValidator(),
    clock: { now: () => new Date('2026-09-24T11:32:00.000Z') },
  });

describe('ResponseSchemaValidator', () => {
  const validator = new ResponseSchemaValidator();

  it('accepts a CaseSummary as JSON text or object and rejects anything off-contract', () => {
    expect(validator.caseSummary(JSON.stringify(grounded))?.confidence).toBe('HIGH');
    expect(validator.caseSummary('not json')).toBeNull();
    expect(validator.caseSummary({ ...grounded, confidence: 'CERTAIN' })).toBeNull();
    expect(validator.caseSummary({ ...grounded, hypothesis: 'x'.repeat(301) })).toBeNull();
    expect(validator.caseSummary({ ...grounded, evidence: Array.from({ length: 6 }, () => grounded.evidence[0]) })).toBeNull();
    expect(validator.caseSummary({ ...grounded, escalate: 'yes' })).toBeNull();
  });

  it('rejects any recommendation to release a held transfer, but not a negation of one', () => {
    expect(validator.caseSummary({ ...grounded, recommendedActions: ['Release the hold; the payee looks familiar'] })).toBeNull();
    expect(validator.caseSummary(grounded)?.recommendedActions).toHaveLength(2);
    expect(validator.riskExplanation({ primaryReason: 'Rapid drain', recommendedAction: 'Let the transfer go through' }, 'a1', 't')).toBeNull();
    expect(validator.riskExplanation({ primaryReason: 'Rapid drain', recommendedAction: 'Contact the customer' }, 'a1', 't')).toMatchObject({
      assessmentId: 'a1',
      primaryReason: 'Rapid drain',
    });
  });
});

describe('SourceFieldValidator', () => {
  it('keeps claims that cite a field in the bundle and drops the rest, counting them', () => {
    const summary = new ResponseSchemaValidator().caseSummary(grounded);
    if (!summary) throw new Error('fixture must validate');
    const result = new SourceFieldValidator().groundedIn(summary, bundle);
    expect(result.summary.evidence.map((item) => item.sourceField)).toEqual(['drain.drainPct', 'assessment.contributions[0].points']);
    expect(result.droppedClaims).toBe(1);
  });

  it('does not treat prototype properties or empty paths as fields', () => {
    const summary = { ...grounded, evidence: [{ claim: 'x', sourceField: '__proto__.constructor', value: 'x' }, { claim: 'y', sourceField: '', value: 'y' }] };
    const result = new SourceFieldValidator().groundedIn(summary as never, bundle);
    expect(result.summary.evidence).toEqual([]);
  });
});

describe('IntelligenceService', () => {
  it('returns a grounded case summary on the first valid response', async () => {
    const model = new ScriptedModel([grounded]);
    const outcome = await serviceWith(model).summariseCase(bundle);
    expect(outcome).toMatchObject({ status: 'GENERATED', attempts: 1, droppedClaims: 1 });
    expect(model.jobs).toEqual(['CASE_SUMMARY']);
  });

  it('retries an invalid response once, then succeeds', async () => {
    const outcome = await serviceWith(new ScriptedModel(['{"hypothesis":', grounded])).summariseCase(bundle);
    expect(outcome).toMatchObject({ status: 'GENERATED', attempts: 2 });
  });

  it('falls back after one retry, never a third call', async () => {
    const model = new ScriptedModel(['garbage', { hypothesis: 'no' }, grounded]);
    expect(await serviceWith(model).summariseCase(bundle)).toEqual({ status: 'FALLBACK', advisory: null, reason: 'INVALID_RESPONSE', attempts: 2 });
    expect(model.jobs).toHaveLength(2);
  });

  it('treats a summary whose every claim is ungrounded as invalid', async () => {
    const ungrounded = { ...grounded, evidence: [{ claim: 'Invented', sourceField: 'nowhere.at.all', value: '1' }] };
    expect(await serviceWith(new ScriptedModel([ungrounded, ungrounded])).summariseCase(bundle)).toMatchObject({ status: 'FALLBACK', reason: 'INVALID_RESPONSE' });
  });

  it('falls back immediately, without retrying, when no model is configured', async () => {
    const model = new ScriptedModel([new ModelUnavailableError('NOT_CONFIGURED', 'GEMINI_DEEP_MODEL unset'), grounded]);
    expect(await serviceWith(model).summariseCase(bundle)).toEqual({ status: 'FALLBACK', advisory: null, reason: 'MODEL_NOT_CONFIGURED', attempts: 1 });
  });

  it('retries a transient outage once, then reports MODEL_UNAVAILABLE', async () => {
    const outage = () => new ModelUnavailableError('TRANSIENT', 'HTTP 503');
    expect(await serviceWith(new ScriptedModel([outage(), outage()])).summariseCase(bundle)).toMatchObject({ status: 'FALLBACK', reason: 'MODEL_UNAVAILABLE', attempts: 2 });
  });

  it('retries a transient outage once and returns the answer that follows', async () => {
    const model = new ScriptedModel([new ModelUnavailableError('TRANSIENT', 'HTTP 429'), grounded]);
    expect(await serviceWith(model).summariseCase(bundle)).toMatchObject({ status: 'GENERATED', attempts: 2 });
  });

  it('never repeats a call that reached the platform ceiling or was rejected: one call, one bill', async () => {
    const timedOut = new ScriptedModel([new ModelUnavailableError('TIMED_OUT', 'ceiling'), grounded]);
    expect(await serviceWith(timedOut).summariseCase(bundle)).toEqual({ status: 'FALLBACK', advisory: null, reason: 'MODEL_TIMED_OUT', attempts: 1 });
    expect(timedOut.jobs).toHaveLength(1);
    const rejected = new ScriptedModel([new ModelUnavailableError('REJECTED', 'HTTP 400'), grounded]);
    expect(await serviceWith(rejected).summariseCase(bundle)).toEqual({ status: 'FALLBACK', advisory: null, reason: 'MODEL_UNAVAILABLE', attempts: 1 });
    expect(rejected.jobs).toHaveLength(1);
  });

  it('shares one model call between simultaneous Explain requests for the same assessment', async () => {
    let release: (value: unknown) => void = () => undefined;
    const calls: ModelJob[] = [];
    const slowModel: ModelGateway = {
      generate: (job) => {
        calls.push(job);
        return new Promise((resolve) => {
          release = resolve;
        });
      },
    };
    const service = serviceWith(slowModel);
    const first = service.explainRisk(bundle, 'assess-6');
    const second = service.explainRisk(bundle, 'assess-6');
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    release({ primaryReason: 'A 65.4% drain followed a new device', recommendedAction: 'Contact the customer' });
    expect(await first).toMatchObject({ status: 'GENERATED', attempts: 1 });
    expect(await second).toBe(await first);
    expect(calls).toEqual(['RISK_EXPLANATION']);
  });

  it('caches a generated explanation by assessmentId and serves it without a model call', async () => {
    const cache = new MemoryCache();
    const model = new ScriptedModel([{ primaryReason: 'A 65% drain after a new device', recommendedAction: 'Contact the customer' }]);
    const service = serviceWith(model, cache);
    expect(await service.explainRisk(bundle, 'assess-1')).toMatchObject({ status: 'GENERATED', attempts: 1 });
    expect(await service.explainRisk(bundle, 'assess-1')).toMatchObject({ status: 'CACHED', attempts: 0, advisory: { generatedAt: '2026-09-24T11:32:00.000Z' } });
    expect(model.jobs).toEqual(['RISK_EXPLANATION']);
  });

  it('explains on the fast job and returns the validated explanation', async () => {
    const model = new ScriptedModel(['{"primaryReason":"A 65.4% drain followed a new device","recommendedAction":"Contact the customer on the number held on file"}']);
    expect(await serviceWith(model).explainRisk(bundle, 'assess-3')).toEqual({
      status: 'GENERATED',
      attempts: 1,
      droppedClaims: 0,
      advisory: {
        assessmentId: 'assess-3',
        primaryReason: 'A 65.4% drain followed a new device',
        recommendedAction: 'Contact the customer on the number held on file',
        generatedAt: '2026-09-24T11:32:00.000Z',
      },
    });
    expect(model.jobs).toEqual(['RISK_EXPLANATION']);
  });

  it('rejects an explanation longer than the contract allows, as Gemini returned on 17 Oct, and falls back', async () => {
    const tooLong = { primaryReason: 'x'.repeat(601), recommendedAction: 'Contact the customer' };
    expect(await serviceWith(new ScriptedModel([tooLong, tooLong])).explainRisk(bundle, 'assess-4')).toEqual({
      status: 'FALLBACK',
      advisory: null,
      reason: 'INVALID_RESPONSE',
      attempts: 2,
    });
  });

  it('falls back immediately, without retrying, when the server has no Google credentials', async () => {
    const model = new ScriptedModel([new ModelUnavailableError('CREDENTIALS', 'no application default credentials'), grounded]);
    expect(await serviceWith(model).explainRisk(bundle, 'assess-5')).toEqual({ status: 'FALLBACK', advisory: null, reason: 'MODEL_CREDENTIALS_UNAVAILABLE', attempts: 1 });
    expect(model.jobs).toHaveLength(1);
  });

  it('never caches a fallback', async () => {
    const cache = new MemoryCache();
    await serviceWith(new ScriptedModel(['x', 'y']), cache).explainRisk(bundle, 'assess-2');
    expect(cache.stored).toEqual([]);
  });
});
