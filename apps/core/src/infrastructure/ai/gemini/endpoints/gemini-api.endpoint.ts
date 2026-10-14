import { ModelUnavailableError } from '../../../../modules/intelligence/application/ports/model-gateway.port.js';
import type { GeminiEndpoint, GeminiRequestTarget } from './gemini-endpoint.js';

/**
 * The Gemini API with a key. The key comes from Secret Manager through configuration, travels only in the
 * x-goog-api-key header (never in a URL, where proxies and logs would keep it) and is never sent to the browser.
 */
export class GeminiApiEndpoint implements GeminiEndpoint {
  readonly provider = 'gemini-api';

  constructor(private readonly apiKey: string | undefined) {}

  async target(model: string): Promise<GeminiRequestTarget> {
    if (!this.apiKey) throw new ModelUnavailableError('NOT_CONFIGURED', 'GEMINI_API_KEY is not set');
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      headers: { 'x-goog-api-key': this.apiKey },
    };
  }
}
