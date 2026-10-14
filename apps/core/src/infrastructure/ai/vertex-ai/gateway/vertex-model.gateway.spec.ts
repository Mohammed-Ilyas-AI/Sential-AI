import type { EvidenceBundle } from '@sentinel/domain';
import { describe, expect, it } from 'vitest';
import { ModelUnavailableError } from '../../../../modules/intelligence/application/ports/model-gateway.port.js';
import { ModelRouter } from '../model-router/model-router.js';
import { EXPLANATION_SYSTEM_INSTRUCTION_V1 } from '../prompts/explanation-system-instruction.v1.js';
import { VertexModelGateway, type VertexTransport } from './vertex-model.gateway.js';

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

  it('turns an HTTP error, a network failure or a timeout into UNAVAILABLE', async () => {
    for (const failure of [new Response('{}', { status: 503 }), new TypeError('fetch failed'), new DOMException('timed out', 'TimeoutError')]) {
      const { transport } = recordingTransport(failure);
      const call = new VertexModelGateway(router, { projectId: 'p', location: 'asia-southeast1' }, transport).generate('CASE_SUMMARY', evidence);
      await expect(call).rejects.toBeInstanceOf(ModelUnavailableError);
      await expect(call).rejects.toMatchObject({ reason: 'UNAVAILABLE' });
    }
  });

  it('returns null for a response with no candidate text, which the validator then rejects', async () => {
    const { transport } = recordingTransport(new Response(JSON.stringify({ candidates: [{ finishReason: 'SAFETY' }] }), { status: 200 }));
    expect(await new VertexModelGateway(router, { projectId: 'p', location: 'asia-southeast1' }, transport).generate('CASE_SUMMARY', evidence)).toBeNull();
  });
});
