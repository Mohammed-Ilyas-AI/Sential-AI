import type { NetworkObservation } from '@sentinel/domain';
import type { RequestHandler } from 'express';
import { validatedBodyOf } from '../../../api/middleware/request-validation.middleware.js';
import type { RecordNetworkObservation } from '../application/record-network-observation.use-case.js';

export class NetworkObservationController {
  constructor(private readonly observations: RecordNetworkObservation) {}

  readonly record: RequestHandler = async (_request, response) => {
    const observation = validatedBodyOf<NetworkObservation>(response);
    await this.observations.record(observation);
    response.status(202).json({ nodes: observation.nodes.length, edges: observation.edges.length });
  };
}
