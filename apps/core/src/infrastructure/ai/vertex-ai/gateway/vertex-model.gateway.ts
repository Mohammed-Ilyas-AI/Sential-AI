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
 * Whole structured responses, not streamed first tokens: the fast tier gets four times its first-token ceiling,
 * the deep tier exactly its completion ceiling (T§10).
 */
const TIMEOUT_MS: Readonly<Record<ModelTier, number>> = {
  FAST: LATENCY_BUDGETS_MS.geminiFastFirstToken.ceiling * 4,
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

function candidateText(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const candidates = (body as { readonly candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) return null;
  const parts = (candidates[0] as { readonly content?: { readonly parts?: unknown } } | undefined)?.content?.parts;
  if (!Array.isArray(parts)) return null;
  const text = parts.map((part: { readonly text?: unknown }) => (typeof part.text === 'string' ? part.text : '')).join('');
  return text === '' ? null : text;
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
  ) {
    this.transport = transport ?? null;
  }

  async generate(job: ModelJob, evidence: EvidenceBundle): Promise<unknown> {
    const model = this.modelFor(job);
    const schema = RESPONSE_SCHEMAS[job];
    const instruction = JOB_INSTRUCTIONS_V1[job];
    if (!schema || !instruction) throw new ModelUnavailableError('NOT_CONFIGURED', `${job} has no response schema wired`);

    this.transport ??= defaultTransport();
    const { projectId, location } = this.vertex;
    const url = `https://${endpointHost(location)}/v1/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}:generateContent`;

    let response: Response;
    try {
      const token = await this.transport.accessToken();
      if (!token) throw new ModelUnavailableError('UNAVAILABLE', 'No application default credentials are available');
      response = await this.transport.fetch(url, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: EXPLANATION_SYSTEM_INSTRUCTION_V1 }] },
          contents: [{ role: 'user', parts: [{ text: instruction }, { text: JSON.stringify(evidence) }] }],
          generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseSchema: toVertexSchema(schema) },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS[MODEL_JOB_TIER[job]]),
      });
    } catch (error) {
      if (error instanceof ModelUnavailableError) throw error;
      throw new ModelUnavailableError('UNAVAILABLE', `Vertex AI call failed for ${job}: ${error instanceof Error ? error.name : 'unknown error'}`);
    }
    if (!response.ok) throw new ModelUnavailableError('UNAVAILABLE', `Vertex AI returned HTTP ${response.status} for ${job}`);
    return candidateText(await response.json().catch(() => null));
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
