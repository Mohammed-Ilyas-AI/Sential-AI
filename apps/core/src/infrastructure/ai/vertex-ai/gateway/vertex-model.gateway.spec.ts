import type { EvidenceBundle } from '@sentinel/domain';
import { describe, expect, it } from 'vitest';
import { ModelUnavailableError } from '../../../../modules/intelligence/application/ports/model-gateway.port.js';
import { ModelRouter } from '../model-router/model-router.js';
import { EXPLANATION_SYSTEM_INSTRUCTION_V1 } from '../prompts/explanation-system-instruction.v1.js';
import { MODEL_CALL_CEILING_MS, VertexModelGateway, type VertexTransport } from './vertex-model.gateway.js';

const evidence = { account: { accountId: 'acct_tok_1' } } as unknown as EvidenceBundle;
const router = new ModelRouter({ fastModel: 'configured-fast-model', deepModel: 'configured-deep-model' });

function recordingTransport(response: Response | Error): { transport: VertexTransport; requests: { url: string; init: RequestInit }[] } {
  const requests: { url: string; init: RequestInit }[] = [];
  return {
    requests,
    transport: {
      accessToken: async () => 'test-access-token',
      fetch: async (input, init) => {
        requests.push({ url: String(input), init: init ?? {} });
        if (response instanceof Error) throw response;
        return response;
      },
    },
  };
}

const vertexReply = (text: string) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });

describe('VertexModelGateway', () => {
  it('calls the configured deep model in the configured region with structured output and the fixed instruction', async () => {
    const { transport, requests } = recordingTransport(vertexReply('{"hypothesis":"h"}'));
    const gateway = new VertexModelGateway(router, { projectId: 'sentinel-test', location: 'asia-southeast1' }, transport);
    expect(await gateway.generate('CASE_SUMMARY', evidence)).toBe('{"hypothesis":"h"}');

    const [request] = requests;
    expect(request?.url).toBe(
      'https://asia-southeast1-aiplatform.googleapis.com/v1/projects/sentinel-test/locations/asia-southeast1/publishers/google/models/configured-deep-model:generateContent',
    );
    expect(new Headers(request?.init.headers).get('authorization')).toBe('Bearer test-access-token');
    expect(request?.url).not.toMatch(/key=/);
    expect(request?.init.signal).toBeInstanceOf(AbortSignal);

    const body = JSON.parse(String(request?.init.body)) as {
      systemInstruction: { parts: { text: string }[] };
      contents: { parts: { text: string }[] }[];
      generationConfig: { responseMimeType: string; responseSchema: { type: string; properties: { evidence: { type: string; maxItems: number } } } };
    };
    expect(body.systemInstruction.parts[0]?.text).toBe(EXPLANATION_SYSTEM_INSTRUCTION_V1);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema.type).toBe('OBJECT');
    expect(body.generationConfig.responseSchema.properties.evidence).toMatchObject({ type: 'ARRAY', maxItems: 5 });
    expect(JSON.parse(body.contents[0]?.parts[1]?.text ?? '')).toEqual(evidence);
  });

  it('routes explanation jobs to the fast model', async () => {
    const { transport, requests } = recordingTransport(vertexReply('{}'));
    await new VertexModelGateway(router, { projectId: 'p', location: 'asia-southeast1' }, transport).generate('RISK_EXPLANATION', evidence);
    expect(requests[0]?.url).toContain('/models/configured-fast-model:generateContent');
  });

  it('reports NOT_CONFIGURED without a call when the project or the tier model is missing', async () => {
    const { transport, requests } = recordingTransport(vertexReply('{}'));
    await expect(new VertexModelGateway(router, { projectId: '', location: 'asia-southeast1' }, transport).generate('CASE_SUMMARY', evidence)).rejects.toMatchObject({
      reason: 'NOT_CONFIGURED',
    });
    await expect(new VertexModelGateway(new ModelRouter({}), { projectId: 'p', location: 'asia-southeast1' }, transport).generate('CASE_SUMMARY', evidence)).rejects.toMatchObject({
      reason: 'NOT_CONFIGURED',
    });
    expect(requests).toHaveLength(0);
  });

  it('classifies failures: 429, 5xx and network errors are TRANSIENT, other 4xx REJECTED, the platform ceiling TIMED_OUT', async () => {
    const cases: [Response | Error, string][] = [
      [new Response('{}', { status: 503 }), 'TRANSIENT'],
      [new Response('{}', { status: 429 }), 'TRANSIENT'],
      [new TypeError('fetch failed'), 'TRANSIENT'],
      [new Response('{}', { status: 400 }), 'REJECTED'],
      [new Response('{}', { status: 403 }), 'REJECTED'],
      [new DOMException('timed out', 'TimeoutError'), 'TIMED_OUT'],
    ];
    for (const [failure, reason] of cases) {
      const { transport } = recordingTransport(failure);
      const call = new VertexModelGateway(router, { projectId: 'p', location: 'asia-southeast1' }, transport).generate('CASE_SUMMARY', evidence);
      await expect(call).rejects.toBeInstanceOf(ModelUnavailableError);
      await expect(call).rejects.toMatchObject({ reason });
    }
  });

  it('has no per-feature deadline: one call may use its share of the 300 s Cloud Run request timeout', () => {
    expect(MODEL_CALL_CEILING_MS).toBe(135_000);
    expect(MODEL_CALL_CEILING_MS * 2).toBeLessThan(300_000);
  });

  it('waits for a slow but valid answer instead of falling back', async () => {
    const slowTransport: VertexTransport = {
      accessToken: async () => 'test-access-token',
      fetch: async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return vertexReply('{"primaryReason":"slow","recommendedAction":"wait"}');
      },
    };
    const answer = await new VertexModelGateway(router, { projectId: 'p', location: 'global', fastThinkingLevel: 'HIGH' }, slowTransport).generate('RISK_EXPLANATION', evidence);
    expect(answer).toBe('{"primaryReason":"slow","recommendedAction":"wait"}');
  });

  it('returns null for a response with no candidate text, which the validator then rejects', async () => {
    const { transport } = recordingTransport(new Response(JSON.stringify({ candidates: [{ finishReason: 'SAFETY' }] }), { status: 200 }));
    expect(await new VertexModelGateway(router, { projectId: 'p', location: 'asia-southeast1' }, transport).generate('CASE_SUMMARY', evidence)).toBeNull();
  });

  it('sends the explanation to the fast model at MEDIUM and the summary to the deep model at HIGH, as configured', async () => {
    const { transport, requests } = recordingTransport(vertexReply('{}'));
    const vertex = { projectId: 'p', location: 'global', fastThinkingLevel: 'MEDIUM', deepThinkingLevel: 'HIGH' };
    const gateway = new VertexModelGateway(router, vertex, transport);
    await gateway.generate('RISK_EXPLANATION', evidence);
    await gateway.generate('CASE_SUMMARY', evidence);

    const [explain, summarise] = requests.map((request) => ({
      url: request.url,
      generationConfig: (JSON.parse(String(request.init.body)) as { generationConfig: Record<string, unknown> }).generationConfig,
    }));
    expect(explain?.url).toBe('https://aiplatform.googleapis.com/v1/projects/p/locations/global/publishers/google/models/configured-fast-model:generateContent');
    expect(explain?.generationConfig).toMatchObject({ responseMimeType: 'application/json', thinkingConfig: { thinkingLevel: 'MEDIUM' } });
    expect(summarise?.url).toContain('/locations/global/publishers/google/models/configured-deep-model:generateContent');
    expect(summarise?.generationConfig).toMatchObject({ responseMimeType: 'application/json', thinkingConfig: { thinkingLevel: 'HIGH' } });
  });

  it('sends no thinkingConfig when no level is configured', async () => {
    const { transport, requests } = recordingTransport(vertexReply('{}'));
    await new VertexModelGateway(router, { projectId: 'p', location: 'global' }, transport).generate('RISK_EXPLANATION', evidence);
    expect(JSON.parse(String(requests[0]?.init.body))).not.toHaveProperty('generationConfig.thinkingConfig');
  });

  it('reports missing application default credentials as CREDENTIALS, without a model call', async () => {
    const warnings: string[] = [];
    const diagnostics = { warn: (_details: object, message: string) => warnings.push(message) };
    for (const accessToken of [async () => null, async () => Promise.reject(new Error('Could not load the default credentials'))]) {
      const { transport, requests } = recordingTransport(vertexReply('{}'));
      const call = new VertexModelGateway(router, { projectId: 'p', location: 'global' }, { ...transport, accessToken }, diagnostics).generate('RISK_EXPLANATION', evidence);
      await expect(call).rejects.toMatchObject({ reason: 'CREDENTIALS' });
      expect(requests).toHaveLength(0);
    }
    expect(warnings).toHaveLength(2);
    expect(warnings.every((warning) => warning.includes('no application default credentials'))).toBe(true);
  });

  it('logs why a call failed, with the Vertex AI status, and never the access token', async () => {
    const logged: { details: object; message: string }[] = [];
    const diagnostics = { warn: (details: object, message: string) => logged.push({ details, message }) };
    const notFound = new Response(JSON.stringify({ error: { code: 404, status: 'NOT_FOUND', message: 'Publisher model not found' } }), { status: 404 });
    for (const failure of [notFound, new DOMException('timed out', 'TimeoutError')]) {
      const { transport } = recordingTransport(failure);
      await expect(new VertexModelGateway(router, { projectId: 'p', location: 'global' }, transport, diagnostics).generate('RISK_EXPLANATION', evidence)).rejects.toBeInstanceOf(
        ModelUnavailableError,
      );
    }
    expect(logged[0]?.message).toContain('HTTP 404 NOT_FOUND: Publisher model not found');
    expect(logged[0]?.details).toMatchObject({ job: 'RISK_EXPLANATION', tier: 'FAST', model: 'configured-fast-model', location: 'global' });
    expect(logged[1]?.message).toContain('no complete response within the 135000 ms platform ceiling');
    expect(JSON.stringify(logged)).not.toContain('test-access-token');
  });

  it('returns a truncated answer for the validator to reject, and logs its finishReason', async () => {
    const logged: string[] = [];
    const truncated = new Response(JSON.stringify({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"primaryReason":"A 65' }] } }] }), { status: 200 });
    const { transport } = recordingTransport(truncated);
    const gateway = new VertexModelGateway(router, { projectId: 'p', location: 'global' }, transport, { warn: (_details, message) => logged.push(message) });
    expect(await gateway.generate('RISK_EXPLANATION', evidence)).toBe('{"primaryReason":"A 65');
    expect(logged).toEqual(['Vertex AI RISK_EXPLANATION finished with MAX_TOKENS']);
  });
});
