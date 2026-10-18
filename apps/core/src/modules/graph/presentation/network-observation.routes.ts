import { Router } from 'express';
import type { HttpRouteRegistration } from '../../../api/http-route-registration.js';
import { validateRequestBody } from '../../../api/middleware/request-validation.middleware.js';
import type { NetworkExplorationController } from './network-exploration.controller.js';
import type { NetworkObservationController } from './network-observation.controller.js';
import { networkObservationValidator } from './network-observation.validator.js';

/** Ingest of permitted observations, and the read-only neighbourhood and fund trace (T§8). */
export function networkObservationRoutes(controller: NetworkObservationController, exploration: NetworkExplorationController): HttpRouteRegistration {
  const router = Router();
  router.post('/observations', validateRequestBody(networkObservationValidator), controller.record);
  router.get('/:rootId/neighbourhood', exploration.neighbourhood);
  router.get('/:rootId/fund-trace', exploration.traceFunds);
  return { basePath: '/v1/network', router };
}
