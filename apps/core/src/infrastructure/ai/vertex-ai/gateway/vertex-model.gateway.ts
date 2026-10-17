import { LATENCY_BUDGETS_MS, MODEL_JOB_TIER, type EvidenceBundle, type ModelJob, type ModelTier } from '@sentinel/domain';
import { GoogleAuth } from 'google-auth-library';
import { ModelUnavailableError, type ModelGateway } from '../../../../modules/intelligence/application/ports/model-gateway.port.js';
import { ModelNotConfiguredError, type ModelRouter } from '../model-router/model-router.js';
import { EXPLANATION_SYSTEM_INSTRUCTION_V1 } from '../prompts/explanation-system-instruction.v1.js';
import { JOB_INSTRUCTIONS_V1 } from '../prompts/job-instructions.v1.js';
import { CASE_SUMMARY_RESPONSE_SCHEMA } from '../response-schemas/case-summary.response-schema.js';
import { RISK_EXPLANATION_RESPONSE_SCHEMA } from '../response-schemas/risk-explanation.response-schema.js';

export interface VertexAiLocation {
  readonly projectId: string;
  readonly location: string;
  /** thinkingConfig.thinkingLevel per tier, validated at startup; unset sends no thinkingConfig. */
  readonly fastThinkingLevel?: string;
  readonly deepThinkingLevel?: string;
}

/** Where gateway failures are explained: the response to the browser only ever carries a fallback reason. */
export interface VertexDiagnostics {
  warn(details: object, message: string): void;
}

export interface VertexTransport {
  readonly fetch: typeof fetch;
  /** An OAuth access token for the runtime service account (application default credentials). */
  readonly accessToken: () => Promise<string | null | undefined>;
}

const RESPONSE_SCHEMAS: Partial<Readonly<Record<ModelJob, object>>> = {
  RISK_EXPLANATION: RISK_EXPLANATION_RESPONSE_SCHEMA,
  CASE_SUMMARY: CASE_SUMMARY_RESPONSE_SCHEMA,
};

/**
 * Whole structured responses, not streamed first tokens, so both tiers get the completion ceiling (T§10).
 * The fast tier's first-token ceiling (x4 = 8 s) was too short for a complete answer: measured on 17 Oct,
 * gemini-3.5-flash took 11.8 s for the explanation at its default thinking level and 2-8 s at MINIMAL, so every
 * Explain timed out twice and fell back. The fast tier stays fast through its thinking level, not its timeout.
 */
const TIMEOUT_MS: Readonly<Record<ModelTier, number>> = {
  FAST: LATENCY_BUDGETS_MS.geminiDeepComplete.ceiling,
  DEEP: LATENCY_BUDGETS_MS.geminiDeepComplete.ceiling,
};

/** Vertex AI's Schema type is an upper-case enum; the schemas here are written in JSON Schema case. */
function toVertexSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toVertexSchema);
  if (typeof schema !== 'object' || schema === null) return schema;
  return Object.fromEntries(
    Object.entries(schema).map(([key, value]) => [key, key === 'type' && typeof value === 'string' ? value.toUpperCase() : toVertexSchema(value)]),
  );
}

function endpointHost(location: string): string {
  return location === 'global' ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`;
}

type VertexCandidate = { readonly content?: { readonly parts?: unknown }; readonly finishReason?: unknown } | undefined;

function firstCandidate(body: unknown): VertexCandidate {
  if (typeof body !== 'object' || body === null) return undefined;
  const candidates = (body as { readonly candidates?: unknown }).candidates;
  return Array.isArray(candidates) ? (candidates[0] as VertexCandidate) : undefined;
}

function candidateText(candidate: VertexCandidate): string | null {
  const parts = candidate?.content?.parts;
  if (!Array.isArray(parts)) return null;
  const text = parts.map((part: { readonly text?: unknown }) => (typeof part.text === 'string' ? part.text : '')).join('');
  return text === '' ? null : text;
}

/** Vertex AI's own error status and message (never a credential), for the server log only. */
async function vertexError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { readonly error?: { readonly status?: unknown; readonly message?: unknown } } | null;
  const status = typeof body?.error?.status === 'string' ? body.error.status : 'unknown status';
  const message = typeof body?.error?.message === 'string' ? body.error.message.slice(0, 300) : '';
  return message ? `${status}: ${message}` : status;
}

const defaultTransport = (): VertexTransport => {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  return { fetch: (input, init) => fetch(input, init), accessToken: () => auth.getAccessToken() };
};

/**
 * The only file that calls Vertex AI: structured output against a response schema, the versioned system
 * instruction, and the service account's own credentials. No API keys, never from the browser, never on the
 * control path. Every failure becomes a ModelUnavailableError; the response text is returned untrusted.
 */
export class VertexModelGateway implements ModelGateway {
  private transport: VertexTransport | null;

  constructor(
    private readonly router: ModelRouter,
    private readonly vertex: VertexAiLocation,
    transport?: VertexTransport,
    private readonly diagnostics?: VertexDiagnostics,
  ) {
    this.transport = transport ?? null;
  }

  async generate(job: ModelJob, evidence: EvidenceBundle): Promise<unknown> {
    const model = this.modelFor(job);
    const schema = RESPONSE_SCHEMAS[job];
    const instruction = JOB_INSTRUCTIONS_V1[job];
    if (!schema || !instruction) throw new ModelUnavailableError('NOT_CONFIGURED', `${job} has no response schema wired`);

    this.transport ??= defaultTransport();
    const tier = MODEL_JOB_TIER[job];
    const { projectId, location } = this.vertex;
    const thinkingLevel = tier === 'FAST' ? this.vertex.fastThinkingLevel : this.vertex.deepThinkingLevel;
    const url = `https://${endpointHost(location)}/v1/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}:generateContent`;
    const failure = (reason: 'CREDENTIALS' | 'UNAVAILABLE', detail: string): ModelUnavailableError => {
      this.diagnostics?.warn({ job, tier, model, location, reason, detail }, `Vertex AI ${job} failed: ${detail}`);
      return new ModelUnavailableError(reason, `Vertex AI ${job}: ${detail}`);
    };

    let token: string | null | undefined;
    try {
      token = await this.transport.accessToken();
    } catch (error) {
      throw failure('CREDENTIALS', `no application default credentials (${error instanceof Error ? error.name : 'unknown error'})`);
    }
    if (!token) throw failure('CREDENTIALS', 'no application default credentials');

    let response: Response;
    try {
      response = await this.transport.fetch(url, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: EXPLANATION_SYSTEM_INSTRUCTION_V1 }] },
          contents: [{ role: 'user', parts: [{ text: instruction }, { text: JSON.stringify(evidence) }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
            responseSchema: toVertexSchema(schema),
            ...(thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {}),
          },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS[tier]),
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : 'unknown error';
      throw failure('UNAVAILABLE', name === 'TimeoutError' ? `no complete response within ${TIMEOUT_MS[tier]} ms` : `request failed (${name})`);
    }
    if (!response.ok) throw failure('UNAVAILABLE', `HTTP ${response.status} ${await vertexError(response)}`);

    const candidate = firstCandidate(await response.json().catch(() => null));
    if (candidate?.finishReason !== undefined && candidate.finishReason !== 'STOP') {
      // Returned anyway: the schema validator decides, and a truncated answer fails it. The log says why.
      this.diagnostics?.warn({ job, tier, model, finishReason: candidate.finishReason }, `Vertex AI ${job} finished with ${String(candidate.finishReason)}`);
    }
    return candidateText(candidate);
  }

  private modelFor(job: ModelJob): string {
    if (!this.vertex.projectId) throw new ModelUnavailableError('NOT_CONFIGURED', 'GCP_PROJECT_ID is not set');
    try {
      return this.router.resolve(job);
    } catch (error) {
      if (error instanceof ModelNotConfiguredError) throw new ModelUnavailableError('NOT_CONFIGURED', error.message);
      throw error;
    }
  }
}
