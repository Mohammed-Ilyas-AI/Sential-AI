import { MODEL_JOB_TIER, MODEL_RESPONSE_MAX_RETRIES, type EvidenceBundle, type ModelJob } from '@sentinel/domain';
import { GoogleAuth } from 'google-auth-library';
import { ModelUnavailableError, type ModelGateway } from '../../../../modules/intelligence/application/ports/model-gateway.port.js';
import { ModelNotConfiguredError, type ModelRouter } from '../model-router/model-router.js';
import { EXPLANATION_SYSTEM_INSTRUCTION_V1 } from '../prompts/explanation-system-instruction.v1.js';
import { JOB_INSTRUCTIONS_V1 } from '../prompts/job-instructions.v1.js';
import { CASE_SUMMARY_RESPONSE_SCHEMA } from '../response-schemas/case-summary.response-schema.js';
import { CUSTOMER_OUTREACH_RESPONSE_SCHEMA } from '../response-schemas/customer-outreach.response-schema.js';
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
  CUSTOMER_OUTREACH: CUSTOMER_OUTREACH_RESPONSE_SCHEMA,
};

/**
 * No per-feature deadline: a slow answer at a higher thinking level is still a valid answer. The only bound is
 * the platform's. sentinel-core's Cloud Run request timeout is 300 s (infra/cloud-run/sentinel-core/service.yaml);
 * 30 s is kept back so the analyst gets an honest fallback instead of a 504, and the rest is shared by the most
 * calls one request can make (a first call plus MODEL_RESPONSE_MAX_RETRIES), so even the worst case fits.
 */
const CLOUD_RUN_REQUEST_TIMEOUT_MS = 300_000;
const RESPONSE_MARGIN_MS = 30_000;
export const MODEL_CALL_CEILING_MS = Math.floor((CLOUD_RUN_REQUEST_TIMEOUT_MS - RESPONSE_MARGIN_MS) / (1 + MODEL_RESPONSE_MAX_RETRIES));

/** 429 and 5xx are worth one more try; any other 4xx will fail the same way again. */
const isTransientStatus = (status: number): boolean => status === 429 || status >= 500;

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
    const failure = (reason: 'CREDENTIALS' | 'TIMED_OUT' | 'REJECTED' | 'TRANSIENT', detail: string): ModelUnavailableError => {
      this.diagnostics?.warn({ job, tier, model, location, thinkingLevel, reason, detail }, `Vertex AI ${job} failed: ${detail}`);
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
        signal: AbortSignal.timeout(MODEL_CALL_CEILING_MS),
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : 'unknown error';
      if (name === 'TimeoutError') throw failure('TIMED_OUT', `no complete response within the ${MODEL_CALL_CEILING_MS} ms platform ceiling`);
      throw failure('TRANSIENT', `request failed (${name})`);
    }
    if (!response.ok) {
      throw failure(isTransientStatus(response.status) ? 'TRANSIENT' : 'REJECTED', `HTTP ${response.status} ${await vertexError(response)}`);
    }

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
