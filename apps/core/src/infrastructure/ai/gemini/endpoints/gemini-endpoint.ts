/** Where one generateContent request goes and how it is authorised. Built per call; never logged. */
export interface GeminiRequestTarget {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
}

/**
 * The two ways sentinel-core reaches Gemini. Both take the same generateContent body; they differ only in URL and
 * credential. Throws ModelUnavailableError: NOT_CONFIGURED when the endpoint has no project or key.
 */
export interface GeminiEndpoint {
  readonly provider: 'vertex-ai' | 'gemini-api';
  target(model: string): Promise<GeminiRequestTarget>;
}
