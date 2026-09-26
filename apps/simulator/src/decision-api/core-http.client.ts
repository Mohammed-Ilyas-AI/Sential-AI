export type FetchFunction = typeof fetch;

export class CoreApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    readonly body: string,
  ) {
    super(`sentinel-core answered ${status} for ${path}: ${body}`);
    this.name = 'CoreApiError';
  }
}

/** JSON over HTTP to sentinel-core. Every call either returns the parsed body or throws with the status. */
export class CoreHttpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchFunction: FetchFunction = fetch,
  ) {}

  async send<TResponse>(method: 'POST' | 'PUT', path: string, body: unknown, headers: Record<string, string> = {}): Promise<TResponse> {
    const response = await this.fetchFunction(`${this.baseUrl}${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) throw new CoreApiError(response.status, path, text);
    return (text ? JSON.parse(text) : null) as TResponse;
  }
}
