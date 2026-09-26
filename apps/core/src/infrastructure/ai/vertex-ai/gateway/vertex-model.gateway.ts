import { NotYetImplementedError } from '@sentinel/domain';
import type { ModelGateway } from '../../../../modules/intelligence/application/ports/model-gateway.port.js';
import type { ModelRouter } from '../model-router/model-router.js';

export interface VertexAiLocation {
  readonly projectId: string;
  readonly location: string;
}

/**
 * The only file that will call Vertex AI: structured output against a response schema, with the
 * service account's own credentials. No API keys, never from the browser, never on the control path.
 */
export class VertexModelGateway implements ModelGateway {
  constructor(
    private readonly router: ModelRouter,
    private readonly vertex: VertexAiLocation,
  ) {}

  generate(): Promise<unknown> {
    throw new NotYetImplementedError('Vertex AI Gemini call', 'scheduled for build order step 9');
  }
}
