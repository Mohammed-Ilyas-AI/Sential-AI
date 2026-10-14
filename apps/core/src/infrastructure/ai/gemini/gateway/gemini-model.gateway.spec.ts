import type { EvidenceBundle } from '@sentinel/domain';
import { describe, expect, it } from 'vitest';
import { ModelUnavailableError } from '../../../../modules/intelligence/application/ports/model-gateway.port.js';
import { GeminiApiEndpoint } from '../endpoints/gemini-api.endpoint.js';
import { VertexAiEndpoint } from '../endpoints/vertex-ai.endpoint.js';
import { ModelRouter } from '../model-router/model-router.js';
import { EXPLANATION_SYSTEM_INSTRUCTION_V1 } from '../prompts/explanation-system-instruction.v1.js';
import { INVESTIGATION_AGENT_SYSTEM_INSTRUCTION_V1 } from '../prompts/investigation-agent-instruction.v1.js';
import { GeminiModelGateway, type HttpFetch } from './gemini-model.gateway.js';

const evidence = { account: { accountId: 'acct_tok_1' } } as unknown as EvidenceBundle;
const router = new ModelRouter({ fastModel: 'configured-fast-model', deepModel: 'configured-deep-model' });
const vertex = (projectId = 'sentinel-test') => new VertexAiEndpoint({ projectId, location: 'asia-southeast1' }, async () => 'test-access-token');
const never = new AbortController().signal;

function recordingHttp(...responses: (Response | Error)[]): { http: HttpFetch; requests: { url: string; init: RequestInit }[] } {
  const requests: { url: string; init: RequestInit }[] = [];
  return {
    requests,
    http: async (input, init) => {
      requests.push({ url: String(input), init: init ?? {} });
      const response = responses.shift() ?? new Response('{}', { status: 500 });
      if (response instanceof Error) throw response;
      return response;
    },
  };
}

const reply = (parts: unknown[]) => new Response(JSON.stringify({ candidates: [{ content: { role: 'model', parts } }] }), { status: 200 });
const textReply = (text: string) => reply([{ text }]);
const bodyOf = (request: { init: RequestInit } | undefined) => JSON.parse(String(request?.init.body)) as Record<string, unknown>;

describe('GeminiModelGateway', () => {
  it('calls the configured deep model on Vertex AI with the service account token, structured output and the fixed instruction', async () => {
    const { http, requests } = recordingHttp(textReply('{"hypothesis":"h"}'));
    expect(await new GeminiModelGateway(router, vertex(), http).generate('CASE_SUMMARY', evidence)).toBe('{"hypothesis":"h"}');

    const [request] = requests;
    expect(request?.url).toBe(
      'https://asia-southeast1-aiplatform.googleapis.com/v1/projects/sentinel-test/locations/asia-southeast1/publishers/google/models/configured-deep-model:generateContent',
    );
    expect(new Headers(request?.init.headers).get('authorization')).toBe('Bearer test-access-token');
    expect(request?.url).not.toMatch(/key=/);
    expect(request?.init.signal).toBeInstanceOf(AbortSignal);

    const body = bodyOf(request) as {
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

  it('calls the Gemini API with the key in a header, never in the URL', async () => {
    const { http, requests } = recordingHttp(textReply('{}'));
    await new GeminiModelGateway(router, new GeminiApiEndpoint('test-api-key'), http).generate('RISK_EXPLANATION', evidence);
    expect(requests[0]?.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/configured-fast-model:generateContent');
    expect(new Headers(requests[0]?.init.headers).get('x-goog-api-key')).toBe('test-api-key');
    expect(new Headers(requests[0]?.init.headers).get('authorization')).toBeNull();
  });

  it('routes explanation jobs to the fast model', async () => {
    const { http, requests } = recordingHttp(textReply('{}'));
    await new GeminiModelGateway(router, vertex(), http).generate('RISK_EXPLANATION', evidence);
    expect(requests[0]?.url).toContain('/models/configured-fast-model:generateContent');
  });

  it('reports NOT_CONFIGURED without a call when the project, the key or the tier model is missing', async () => {
    const { http, requests } = recordingHttp();
    for (const gateway of [
      new GeminiModelGateway(router, vertex(''), http),
      new GeminiModelGateway(router, new GeminiApiEndpoint(undefined), http),
      new GeminiModelGateway(new ModelRouter({}), vertex(), http),
    ]) {
      await expect(gateway.generate('CASE_SUMMARY', evidence)).rejects.toMatchObject({ reason: 'NOT_CONFIGURED' });
      await expect(gateway.step([], { submitOnly: false, signal: never })).rejects.toMatchObject({ reason: 'NOT_CONFIGURED' });
    }
    expect(requests).toHaveLength(0);
  });

  it('turns an HTTP error, a network failure or a timeout into UNAVAILABLE', async () => {
    for (const failure of [new Response('{}', { status: 503 }), new TypeError('fetch failed'), new DOMException('timed out', 'TimeoutError')]) {
      const { http } = recordingHttp(failure);
      const call = new GeminiModelGateway(router, vertex(), http).generate('CASE_SUMMARY', evidence);
      await expect(call).rejects.toBeInstanceOf(ModelUnavailableError);
      await expect(call).rejects.toMatchObject({ reason: 'UNAVAILABLE' });
    }
  });

  it('returns null for a response with no candidate text, which the validator then rejects', async () => {
    const { http } = recordingHttp(new Response(JSON.stringify({ candidates: [{ finishReason: 'SAFETY' }] }), { status: 200 }));
    expect(await new GeminiModelGateway(router, vertex(), http).generate('CASE_SUMMARY', evidence)).toBeNull();
  });

  describe('agent step', () => {
    it('declares the read-only tools on the deep model, forces a tool call and returns the calls', async () => {
      const modelPart = { functionCall: { name: 'get_risk_assessment', args: {} }, thoughtSignature: 'opaque-signature' };
      const { http, requests } = recordingHttp(reply([modelPart]));
      const result = await new GeminiModelGateway(router, new GeminiApiEndpoint('k'), http).step([{ kind: 'TASK', task: { assessmentId: 'A-1' } }], {
        submitOnly: false,
        signal: never,
      });

      expect(result.invocations).toEqual([{ name: 'get_risk_assessment', args: {} }]);
      expect(requests[0]?.url).toContain('/models/configured-deep-model:generateContent');
      const body = bodyOf(requests[0]) as {
        systemInstruction: { parts: { text: string }[] };
        contents: { role: string; parts: { text: string }[] }[];
        tools: { functionDeclarations: { name: string; parameters?: { type: string } }[] }[];
        toolConfig: { functionCallingConfig: { mode: string; allowedFunctionNames?: string[] } };
      };
      expect(body.systemInstruction.parts[0]?.text).toBe(INVESTIGATION_AGENT_SYSTEM_INSTRUCTION_V1);
      expect(JSON.parse(body.contents[0]?.parts[1]?.text ?? '')).toEqual({ assessmentId: 'A-1' });
      const names = body.tools[0]?.functionDeclarations.map((tool) => tool.name) ?? [];
      expect(names).toContain('submit_findings');
      expect(names.every((name) => name.startsWith('get_') || name.startsWith('inspect_') || name === 'submit_findings')).toBe(true);
      expect(body.tools[0]?.functionDeclarations.find((tool) => tool.name === 'submit_findings')?.parameters?.type).toBe('OBJECT');
      expect(body.toolConfig.functionCallingConfig).toEqual({ mode: 'ANY' });
    });

    it('echoes the model turn back verbatim (thought signatures included) and restricts the last turn to submit_findings', async () => {
      const providerContent = { role: 'model', parts: [{ functionCall: { name: 'get_drain_state', args: {} }, thoughtSignature: 'opaque-signature' }] };
      const { http, requests } = recordingHttp(reply([{ functionCall: { name: 'submit_findings', args: { hypothesis: 'h' } } }]));
      await new GeminiModelGateway(router, vertex(), http).step(
        [
          { kind: 'TASK', task: {} },
          { kind: 'MODEL', invocations: [{ name: 'get_drain_state', args: {} }], providerContent },
          { kind: 'TOOL_OUTPUTS', outputs: [{ name: 'get_drain_state', response: { drain: { drainPct: 65 } } }] },
        ],
        { submitOnly: true, signal: never },
      );
      const body = bodyOf(requests[0]) as { contents: unknown[]; toolConfig: { functionCallingConfig: unknown } };
      expect(body.contents[1]).toEqual(providerContent);
      expect(body.contents[2]).toEqual({ role: 'user', parts: [{ functionResponse: { name: 'get_drain_state', response: { drain: { drainPct: 65 } } } }] });
      expect(body.toolConfig.functionCallingConfig).toEqual({ mode: 'ANY', allowedFunctionNames: ['submit_findings'] });
    });
  });
});
