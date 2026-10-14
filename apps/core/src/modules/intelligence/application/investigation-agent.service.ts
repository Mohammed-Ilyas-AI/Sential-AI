import {
  AGENT_INVESTIGATION_DEADLINE_MS,
  AGENT_MAX_CALLS_PER_ROUND,
  AGENT_MAX_TOOL_ROUNDS,
  AGENT_SUBMIT_FINDINGS_TOOL,
  AGENT_TOOL_BUNDLE_FIELD,
  MODEL_RESPONSE_MAX_RETRIES,
  type AdvisoryFallbackReason,
  type AdvisoryOutcome,
  type AgentInvestigation,
  type AgentToolStep,
  type EvidenceBundle,
} from '@sentinel/domain';
import type { Clock } from '../../../platform/time/clock.js';
import { AgentEvidenceToolbox } from './agent-evidence.toolbox.js';
import type { InvestigateWithAgent } from './investigate-with-agent.use-case.js';
import type { AgentModelGateway, AgentStepReply, AgentToolOutput, AgentTurn } from './ports/agent-model-gateway.port.js';
import { ModelUnavailableError } from './ports/model-gateway.port.js';
import type { ResponseSchemaValidator } from './response-schema.validator.js';
import type { SourceFieldValidator } from './source-field.validator.js';

export interface InvestigationAgentDependencies {
  readonly agentGateway: AgentModelGateway;
  readonly responseSchemas: ResponseSchemaValidator;
  readonly sourceFields: SourceFieldValidator;
  readonly clock: Clock;
}

type StepResult = { readonly reply: AgentStepReply } | { readonly fallback: AdvisoryFallbackReason };

/**
 * The agent loop. Gemini decides which evidence to read and when it has enough; this service decides everything
 * else: which tools exist (read-only, scoped to one bundle), how many turns it gets, what counts as a valid
 * finding, and that every claim cites a section the agent actually retrieved. Findings that fail validation are
 * sent back once as a tool error; anything else ends as FALLBACK. Nothing here can change a score, a decision
 * or a hold, and nothing on the control path can reach it.
 */
export class InvestigationAgentService implements InvestigateWithAgent {
  constructor(private readonly dependencies: InvestigationAgentDependencies) {}

  async investigate(evidence: EvidenceBundle, assessmentId: string): Promise<AdvisoryOutcome<AgentInvestigation>> {
    const { responseSchemas, sourceFields, clock } = this.dependencies;
    const toolbox = new AgentEvidenceToolbox(evidence);
    const signal = AbortSignal.timeout(AGENT_INVESTIGATION_DEADLINE_MS);
    const retrieved: Partial<Record<keyof EvidenceBundle, unknown>> = {};
    const steps: AgentToolStep[] = [];
    const turns: AgentTurn[] = [{ kind: 'TASK', task: { assessmentId, accountId: evidence.account.accountId, transactionId: evidence.assessment.transactionId } }];
    let attempts = 0;
    let rejectedFindings = false;

    for (let round = 1; round <= AGENT_MAX_TOOL_ROUNDS + 1; round += 1) {
      const submitOnly = round > AGENT_MAX_TOOL_ROUNDS;
      const step = await this.step(turns, submitOnly, signal);
      attempts += step.attempts;
      if ('fallback' in step.result) return { status: 'FALLBACK', advisory: null, reason: step.result.fallback, attempts };
      const { reply } = step.result;
      if (reply.invocations.length === 0) return { status: 'FALLBACK', advisory: null, reason: 'INVALID_RESPONSE', attempts };
      turns.push({ kind: 'MODEL', invocations: reply.invocations, providerContent: reply.providerContent });

      const submission = reply.invocations.find((invocation) => invocation.name === AGENT_SUBMIT_FINDINGS_TOOL);
      if (submission) {
        const summary = responseSchemas.caseSummary(submission.args);
        const grounded = summary ? sourceFields.groundedIn(summary, retrieved) : null;
        const usable = summary !== null && grounded !== null && (summary.evidence.length === 0 || grounded.summary.evidence.length > 0);
        if (usable) {
          return {
            status: 'GENERATED',
            advisory: { assessmentId, steps, rounds: round, summary: grounded.summary, generatedAt: clock.now().toISOString() },
            attempts,
            droppedClaims: grounded.droppedClaims,
          };
        }
        if (rejectedFindings || submitOnly) return { status: 'FALLBACK', advisory: null, reason: 'INVALID_RESPONSE', attempts };
        rejectedFindings = true;
      }

      const outputs: AgentToolOutput[] = reply.invocations.map((invocation, index) => {
        if (invocation.name === AGENT_SUBMIT_FINDINGS_TOOL) {
          return {
            name: invocation.name,
            response: {
              error:
                'Findings rejected: they must match the schema, must not recommend releasing a held transfer, and every ' +
                'sourceField must name a field in evidence you retrieved with a tool. Gather what you need, then submit again.',
            },
          };
        }
        if (index >= AGENT_MAX_CALLS_PER_ROUND) return { name: invocation.name, response: { error: `At most ${AGENT_MAX_CALLS_PER_ROUND} tool calls per turn.` } };
        const result = toolbox.run(invocation.name, invocation.args);
        if (!result) return { name: invocation.name, response: { error: 'Unknown tool.' } };
        const bundleField = AGENT_TOOL_BUNDLE_FIELD[result.tool];
        if (result.records > 0 || result.tool !== 'inspect_network_entity') retrieved[bundleField] = evidence[bundleField];
        steps.push({ round, tool: result.tool, args: invocation.args, bundleField, records: result.records });
        return { name: invocation.name, response: result.response };
      });
      turns.push({ kind: 'TOOL_OUTPUTS', outputs });
    }
    return { status: 'FALLBACK', advisory: null, reason: 'INVALID_RESPONSE', attempts };
  }

  /** One model turn, retried once when the model is unavailable; a missing model is never retried. */
  private async step(turns: readonly AgentTurn[], submitOnly: boolean, signal: AbortSignal): Promise<{ readonly result: StepResult; readonly attempts: number }> {
    let attempts = 0;
    while (attempts <= MODEL_RESPONSE_MAX_RETRIES && !signal.aborted) {
      attempts += 1;
      try {
        return { result: { reply: await this.dependencies.agentGateway.step(turns, { submitOnly, signal }) }, attempts };
      } catch (error) {
        if (!(error instanceof ModelUnavailableError)) throw error;
        if (error.reason === 'NOT_CONFIGURED') return { result: { fallback: 'MODEL_NOT_CONFIGURED' }, attempts };
      }
    }
    return { result: { fallback: 'MODEL_UNAVAILABLE' }, attempts };
  }
}
