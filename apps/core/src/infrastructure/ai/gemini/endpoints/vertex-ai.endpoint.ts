import { GoogleAuth } from 'google-auth-library';
import { ModelUnavailableError } from '../../../../modules/intelligence/application/ports/model-gateway.port.js';
import type { GeminiEndpoint, GeminiRequestTarget } from './gemini-endpoint.js';

export interface VertexAiLocation {
  readonly projectId: string;
  readonly location: string;
}

/** An OAuth access token for the runtime service account (application default credentials). */
export type AccessTokenSource = () => Promise<string | null | undefined>;

function endpointHost(location: string): string {
  return location === 'global' ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`;
}

const applicationDefaultCredentials = (): AccessTokenSource => {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  return () => auth.getAccessToken();
};

/** Vertex AI with the service account's own credentials: no key exists anywhere. */
export class VertexAiEndpoint implements GeminiEndpoint {
  readonly provider = 'vertex-ai';
  private accessToken: AccessTokenSource | null;

  constructor(
    private readonly vertex: VertexAiLocation,
    accessToken?: AccessTokenSource,
  ) {
    this.accessToken = accessToken ?? null;
  }

  async target(model: string): Promise<GeminiRequestTarget> {
    const { projectId, location } = this.vertex;
    if (!projectId) throw new ModelUnavailableError('NOT_CONFIGURED', 'GCP_PROJECT_ID is not set');
    this.accessToken ??= applicationDefaultCredentials();
    const token = await this.accessToken();
    if (!token) throw new ModelUnavailableError('UNAVAILABLE', 'No application default credentials are available');
    return {
      url: `https://${endpointHost(location)}/v1/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}:generateContent`,
      headers: { authorization: `Bearer ${token}` },
    };
  }
}
