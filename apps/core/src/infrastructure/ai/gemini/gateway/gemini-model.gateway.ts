import { AGENT_SUBMIT_FINDINGS_TOOL, LATENCY_BUDGETS_MS, MODEL_JOB_TIER, type EvidenceBundle, type ModelJob, type ModelTier } from '@sentinel/domain';
import type {
  AgentModelGateway,
  AgentStepReply,
  AgentToolInvocation,
  AgentTurn,
} from '../../../../modules/intelligence/application/ports/agent-model-gateway.port.js';
import { ModelUnavailableError, type ModelGateway } from '../../../../modules/intelligence/application/ports/model-gateway.port.js';
import type { GeminiEndpoint } from '../endpoints/gemini-endpoint.js';
import { ModelNotConfiguredError, type ModelRouter } from '../model-router/model-router.js';
import { EXPLANATION_SYSTEM_INSTRUCTION_V1 } from '../prompts/explanation-system-instruction.v1.js';
import { INVESTIGATION_AGENT_SYSTEM_INSTRUCTION_V1, INVESTIGATION_AGENT_TASK_V1 } from '../prompts/investigation-agent-instruction.v1.js';
import { INVESTIGATION_AGENT_TOOLS_V1 } from '../prompts/investigation-agent-tools.v1.js';
import { JOB_INSTRUCTIONS_V1 } from '../prompts/job-instructions.v1.js';
import { CASE_SUMMARY_RESPONSE_SCHEMA } from '../response-schemas/case-summary.response-schema.js';
import { RISK_EXPLANATION_RESPONSE_SCHEMA } from '../response-schemas/risk-explanation.response-schema.js';

export type HttpFetch = typeof fetch;

const RESPONSE_SCHEMAS: Partial<Readonly<Record<ModelJob, object>>> = {
  RISK_EXPLANATION: RISK_EXPLANATION_RESPONSE_SCHEMA,
  CASE_SUMMARY: CASE_SUMMARY_RESPONSE_SCHEMA,
};

/** The agent correlates evidence across sources: the deep tier (T§7, "multi-source evidence correlation"). */
const AGENT_JOB: ModelJob = 'EVIDENCE_CORRELATION';

/**
 * Whole structured responses, not streamed first tokens: the fast tier gets four times its first-token ceiling,
 * the deep tier exactly its completion ceiling (T§10). One agent turn is one deep-tier call.
 */
const TIMEOUT_MS: Readonly<Record<ModelTier, number>> = {
  FAST: LATENCY_BUDGETS_MS.geminiFastFirstToken.ceiling * 4,
  DEEP: LATENCY_BUDGETS_MS.geminiDeepComplete.ceiling,
};

type JsonObject = Readonly<Record<string, unknown>>;

const isObject = (value: unknown): value is JsonObject => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Gemini's Schema type is an upper-case enum; the schemas here are written in JSON Schema case. */
function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (!isObject(schema)) return schema;
  return Object.fromEntries(
    Object.entries(schema).map(([key, value]) => [key, key === 'type' && typeof value === 'string' ? value.toUpperCase() : toGeminiSchema(value)]),
  );
}

function firstCandidateContent(body: unknown): JsonObject | null {
  if (!isObject(body) || !Array.isArray(body['candidates'])) return null;
  const content = (body['candidates'][0] as { readonly content?: unknown } | undefined)?.content;
  return isObject(content) ? content : null;
}

function partsOf(content: JsonObject | null): readonly JsonObject[] {
  const parts = content?.['parts'];
  return Array.isArray(parts) ? parts.filter(isObject) : [];
}

function candidateText(body: unknown): string | null {
  const text = partsOf(firstCandidateContent(body))
    .map((part) => (typeof part['text'] === 'string' ? part['text'] : ''))
    .join('');
  return text === '' ? null : text;
}

function invocationsOf(content: JsonObject | null): readonly AgentToolInvocation[] {
  return partsOf(content).flatMap((part) => {
    const call = part['functionCall'];
    if (!isObject(call) || typeof call['name'] !== 'string') return [];
    return [{ name: call['name'], args: isObject(call['args']) ? call['args'] : {} }];
  });
}

/** Provider-neutral turns to Gemini contents. A model turn is sent back exactly as Gemini returned it. */
function contentsOf(turns: readonly AgentTurn[]): readonly unknown[] {
  return turns.map((turn) => {
    switch (turn.kind) {
      case 'TASK':
        return { role: 'user', parts: [{ text: INVESTIGATION_AGENT_TASK_V1 }, { text: JSON.stringify(turn.task) }] };
      case 'MODEL':
        return isObject(turn.providerContent)
          ? turn.providerContent
          : { role: 'model', parts: turn.invocations.map((invocation) => ({ functionCall: { name: invocation.name, args: invocation.args } })) };
      case 'TOOL_OUTPUTS':
        return {
          role: 'user',
          parts: turn.outputs.map((output) => ({
            functionResponse: { name: output.name, response: isObject(output.response) ? output.response : { result: output.response } },
          })),
        };
    }
  });
}

/**
 * The only class that calls Gemini, through Vertex AI (service account) or the Gemini API (key from Secret
 * Manager), never from the browser and never on the control path. Structured output for explanation and summary;
 * function calling for the investigation agent. Every failure becomes a ModelUnavailableError; everything Gemini
 * returns is untrusted until the application validators have checked it.
 */
export class GeminiModelGateway implements ModelGateway, AgentModelGateway {
  constructor(
    private readonly router: ModelRouter,
    private readonly endpoint: GeminiEndpoint,
    private readonly http: HttpFetch = (input, init) => fetch(input, init),
  ) {}

  async generate(job: ModelJob, evidence: EvidenceBundle): Promise<unknown> {
    const schema = RESPONSE_SCHEMAS[job];
    const instruction = JOB_INSTRUCTIONS_V1[job];
    if (!schema || !instruction) throw new ModelUnavailableError('NOT_CONFIGURED', `${job} has no response schema wired`);
    const body = await this.post(job, AbortSignal.timeout(TIMEOUT_MS[MODEL_JOB_TIER[job]]), {
      systemInstruction: { parts: [{ text: EXPLANATION_SYSTEM_INSTRUCTION_V1 }] },
      contents: [{ role: 'user', parts: [{ text: instruction }, { text: JSON.stringify(evidence) }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseSchema: toGeminiSchema(schema) },
    });
    return candidateText(body);
  }

  async step(turns: readonly AgentTurn[], options: { readonly submitOnly: boolean; readonly signal: AbortSignal }): Promise<AgentStepReply> {
    const signal = AbortSignal.any([options.signal, AbortSignal.timeout(TIMEOUT_MS[MODEL_JOB_TIER[AGENT_JOB]])]);
    const body = await this.post(AGENT_JOB, signal, {
      systemInstruction: { parts: [{ text: INVESTIGATION_AGENT_SYSTEM_INSTRUCTION_V1 }] },
      contents: contentsOf(turns),
      tools: [
        {
          functionDeclarations: INVESTIGATION_AGENT_TOOLS_V1.map((tool) =>
            tool.parameters ? { ...tool, parameters: toGeminiSchema(tool.parameters) } : tool,
          ),
        },
      ],
      // ANY: every turn is a tool call, so the agent never answers in free text. The last turn may only submit.
      toolConfig: {
        functionCallingConfig: { mode: 'ANY', ...(options.submitOnly ? { allowedFunctionNames: [AGENT_SUBMIT_FINDINGS_TOOL] } : {}) },
      },
    });
    const content = firstCandidateContent(body);
    return { invocations: invocationsOf(content), providerContent: content };
  }

  private async post(job: ModelJob, signal: AbortSignal, request: object): Promise<unknown> {
    const model = this.modelFor(job);
    let response: Response;
    try {
      const target = await this.endpoint.target(model);
      response = await this.http(target.url, {
        method: 'POST',
        headers: { ...target.headers, 'content-type': 'application/json' },
        body: JSON.stringify(request),
        signal,
      });
    } catch (error) {
      if (error instanceof ModelUnavailableError) throw error;
      throw new ModelUnavailableError('UNAVAILABLE', `${this.endpoint.provider} call failed for ${job}: ${error instanceof Error ? error.name : 'unknown error'}`);
    }
    if (!response.ok) throw new ModelUnavailableError('UNAVAILABLE', `${this.endpoint.provider} returned HTTP ${response.status} for ${job}`);
    return response.json().catch(() => null);
  }

  private modelFor(job: ModelJob): string {
    try {
      return this.router.resolve(job);
    } catch (error) {
      if (error instanceof ModelNotConfiguredError) throw new ModelUnavailableError('NOT_CONFIGURED', error.message);
      throw error;
    }
  }
}
