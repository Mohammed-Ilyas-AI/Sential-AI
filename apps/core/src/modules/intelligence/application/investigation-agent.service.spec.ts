import { AGENT_MAX_TOOL_ROUNDS, type EvidenceBundle } from '@sentinel/domain';
import { describe, expect, it } from 'vitest';
import { InvestigationAgentService } from './investigation-agent.service.js';
import type { AgentModelGateway, AgentStepReply, AgentToolInvocation, AgentTurn } from './ports/agent-model-gateway.port.js';
import { ModelUnavailableError } from './ports/model-gateway.port.js';
import { ResponseSchemaValidator } from './response-schema.validator.js';
import { SourceFieldValidator } from './source-field.validator.js';

const bundle = {
  account: { accountId: 'acct_tok_victim', institutionId: 'BANK_A', openedAt: '2019-01-01T00:00:00.000Z', protected: true },
  assessment: {
    transactionId: 'TX-1',
    score: 95,
    band: 'CRITICAL',
    contributions: [{ code: 'RAPID_DRAIN', label: 'Rapid drain', points: 30 }],
    drain: { balanceAtWindowStart: 5_200_000, outflow24h: 3_400_000, drainPct: 65.38, thresholdMet: true, excluded: false },
    evaluatedAt: '2026-09-24T11:31:00.000Z',
  },
  drain: { balanceAtWindowStart: 5_200_000, outflow24h: 3_400_000, drainPct: 65.38, thresholdMet: true, excluded: false },
  recentTransactions: [],
  deviceHistory: [{ deviceId: 'dev_tok_new', eventType: 'NEW_DEVICE_LOGIN', occurredAt: '2026-09-24T11:20:00.000Z' }],
  payeeHistory: [],
  priorAlerts: [],
  interventions: [],
  neighbourhood: {
    rootId: 'acct_tok_victim',
    hopDepth: 2,
    nodes: [
      { id: 'acct_tok_victim', kind: 'ACCOUNT', flagged: false, riskIndicators: [], txCount: 3 },
      { id: 'acct_tok_mule', kind: 'ACCOUNT', flagged: true, riskIndicators: ['RAPID_MOVEMENT'], txCount: 9 },
    ],
    edges: [{ from: 'acct_tok_victim', to: 'acct_tok_mule', kind: 'TRANSFERRED_TO', weight: 3_400_000 }],
    truncated: false,
  },
} as unknown as EvidenceBundle;

const findings = (overrides: Record<string, unknown> = {}) => ({
  hypothesis: 'Account takeover: a new device preceded a 65% drain of a protected balance into a flagged account.',
  confidence: 'HIGH',
  evidence: [
    { claim: 'The drain crossed the published threshold', sourceField: 'drain.drainPct', value: '65.38' },
    { claim: 'A new device logged in first', sourceField: 'deviceHistory[0].eventType', value: 'NEW_DEVICE_LOGIN' },
    { claim: 'The receiving account is flagged', sourceField: 'neighbourhood.nodes[1].flagged', value: 'true' },
  ],
  recommendedActions: ['Contact the customer on the number held on file'],
  escalate: true,
  ...overrides,
});

const calls = (...invocations: AgentToolInvocation[]): AgentStepReply => ({ invocations, providerContent: { role: 'model', parts: invocations } });
const call = (name: string, args: Record<string, unknown> = {}): AgentToolInvocation => ({ name, args });

class ScriptedAgent implements AgentModelGateway {
  readonly requests: { turns: readonly AgentTurn[]; submitOnly: boolean }[] = [];
  constructor(private readonly script: (AgentStepReply | Error)[]) {}
  async step(turns: readonly AgentTurn[], options: { readonly submitOnly: boolean }): Promise<AgentStepReply> {
    this.requests.push({ turns: [...turns], submitOnly: options.submitOnly });
    const next = this.script.shift() ?? calls();
    if (next instanceof Error) throw next;
    return next;
  }
}

const clock = { now: () => new Date('2026-09-24T11:32:00.000Z') };
const agentWith = (gateway: AgentModelGateway) =>
  new InvestigationAgentService({ agentGateway: gateway, responseSchemas: new ResponseSchemaValidator(), sourceFields: new SourceFieldValidator(), clock });

describe('InvestigationAgentService', () => {
  it('lets Gemini gather evidence through read-only tools, then returns grounded findings and the trace', async () => {
    const gateway = new ScriptedAgent([
      calls(call('get_risk_assessment'), call('get_drain_state')),
      calls(call('get_device_history'), call('inspect_network_entity', { entityId: 'acct_tok_mule' })),
      calls(call('submit_findings', findings())),
    ]);
    const outcome = await agentWith(gateway).investigate(bundle, 'A-1');

    expect(outcome.status).toBe('GENERATED');
    if (outcome.status !== 'GENERATED') return;
    expect(outcome.advisory.rounds).toBe(3);
    expect(outcome.droppedClaims).toBe(0);
    expect(outcome.advisory.steps.map((step) => [step.round, step.tool, step.records])).toEqual([
      [1, 'get_risk_assessment', 1],
      [1, 'get_drain_state', 1],
      [2, 'get_device_history', 1],
      [2, 'inspect_network_entity', 2],
    ]);
    // The task names the assessment only; the evidence arrives through tool outputs, never spliced into a prompt.
    expect(gateway.requests[0]?.turns[0]).toEqual({ kind: 'TASK', task: { assessmentId: 'A-1', accountId: 'acct_tok_victim', transactionId: 'TX-1' } });
    const outputs = gateway.requests[1]?.turns[2];
    expect(outputs).toMatchObject({ kind: 'TOOL_OUTPUTS', outputs: [{ name: 'get_risk_assessment', response: { assessment: bundle.assessment } }, { name: 'get_drain_state' }] });
  });

  it('drops a claim that cites evidence the agent never retrieved, even though the bundle holds it', async () => {
    const outcome = await agentWith(new ScriptedAgent([calls(call('get_drain_state'), call('get_device_history')), calls(call('submit_findings', findings()))])).investigate(
      bundle,
      'A-1',
    );
    expect(outcome).toMatchObject({ status: 'GENERATED', droppedClaims: 1 });
    if (outcome.status === 'GENERATED') expect(outcome.advisory.summary.evidence.map((item) => item.sourceField)).toEqual(['drain.drainPct', 'deviceHistory[0].eventType']);
  });

  it('sends rejected findings back once as a tool error, and accepts the corrected submission', async () => {
    const gateway = new ScriptedAgent([
      calls(call('get_drain_state')),
      calls(call('submit_findings', findings({ recommendedActions: ['Release the held transfer'] }))),
      calls(call('get_device_history')),
      calls(call('submit_findings', findings({ evidence: [findings().evidence[0]] }))),
    ]);
    const outcome = await agentWith(gateway).investigate(bundle, 'A-1');
    expect(outcome.status).toBe('GENERATED');
    expect(gateway.requests[2]?.turns.at(-1)).toMatchObject({ kind: 'TOOL_OUTPUTS', outputs: [{ name: 'submit_findings', response: { error: expect.stringContaining('rejected') } }] });
  });

  it('falls back after a second invalid submission', async () => {
    const release = calls(call('submit_findings', findings({ recommendedActions: ['Release the held transfer'] })));
    expect(await agentWith(new ScriptedAgent([release, release])).investigate(bundle, 'A-1')).toMatchObject({ status: 'FALLBACK', reason: 'INVALID_RESPONSE' });
  });

  it('forces the last turn to submit, and falls back if the agent never does', async () => {
    const gateway = new ScriptedAgent(Array.from({ length: AGENT_MAX_TOOL_ROUNDS + 1 }, () => calls(call('get_drain_state'))));
    expect(await agentWith(gateway).investigate(bundle, 'A-1')).toMatchObject({ status: 'FALLBACK', reason: 'INVALID_RESPONSE' });
    expect(gateway.requests.map((request) => request.submitOnly)).toEqual([...Array.from({ length: AGENT_MAX_TOOL_ROUNDS }, () => false), true]);
  });

  it('answers unknown tools with an error and records no step for them', async () => {
    const gateway = new ScriptedAgent([calls(call('release_hold', { transactionId: 'TX-1' }), call('get_drain_state')), calls(call('submit_findings', findings({ evidence: [] })))]);
    const outcome = await agentWith(gateway).investigate(bundle, 'A-1');
    expect(outcome.status).toBe('GENERATED');
    if (outcome.status === 'GENERATED') expect(outcome.advisory.steps.map((step) => step.tool)).toEqual(['get_drain_state']);
    expect(gateway.requests[1]?.turns.at(-1)).toMatchObject({ outputs: [{ name: 'release_hold', response: { error: 'Unknown tool.' } }, { name: 'get_drain_state' }] });
  });

  it('treats a turn without a tool call as invalid', async () => {
    expect(await agentWith(new ScriptedAgent([calls()])).investigate(bundle, 'A-1')).toMatchObject({ status: 'FALLBACK', reason: 'INVALID_RESPONSE' });
  });

  it('reports a missing model without retrying, and an unavailable one after one retry', async () => {
    const missing = new ScriptedAgent([new ModelUnavailableError('NOT_CONFIGURED', 'no model')]);
    expect(await agentWith(missing).investigate(bundle, 'A-1')).toMatchObject({ status: 'FALLBACK', reason: 'MODEL_NOT_CONFIGURED', attempts: 1 });

    const down = new ScriptedAgent([new ModelUnavailableError('UNAVAILABLE', 'down'), new ModelUnavailableError('UNAVAILABLE', 'down')]);
    expect(await agentWith(down).investigate(bundle, 'A-1')).toMatchObject({ status: 'FALLBACK', reason: 'MODEL_UNAVAILABLE', attempts: 2 });
  });
});
