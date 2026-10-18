import { GRAPH_MAX_HOPS, type GraphHopDepth } from '@sentinel/domain';
import type { RequestHandler } from 'express';
import { lensOf } from '../../tenant-access/presentation/tenant-lens.middleware.js';
import type { ExploreNetwork } from '../application/explore-network.use-case.js';

type RootParameters = { rootId: string };

/** Read-only network views, projected through the request lens before they leave the server. */
export class NetworkExplorationController {
  constructor(private readonly network: ExploreNetwork) {}

  readonly neighbourhood: RequestHandler<RootParameters> = async (request, response) => {
    const requested = request.query['hops'] ?? String(GRAPH_MAX_HOPS);
    if (requested !== '1' && requested !== '2') {
      response.status(400).json({ error: 'invalid_request', problems: ['hops must be 1 or 2'] });
      return;
    }
    const hops = Number(requested) as GraphHopDepth;
    response.status(200).json(await this.network.neighbourhood(request.params.rootId, hops, lensOf(response)));
  };

  readonly traceFunds: RequestHandler<RootParameters> = async (request, response) => {
    const via = typeof request.query['via'] === 'string' && request.query['via'] !== '' ? request.query['via'] : undefined;
    response.status(200).json(await this.network.traceFunds(request.params.rootId, lensOf(response), via));
  };
}
