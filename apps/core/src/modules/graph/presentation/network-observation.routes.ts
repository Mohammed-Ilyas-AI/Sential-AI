import { Router } from 'express';
import type { HttpRouteRegistration } from '../../../api/http-route-registration.js';
import { validateRequestBody } from '../../../api/middleware/request-validation.middleware.js';
import type { NetworkObservationController } from './network-observation.controller.js';
import { networkObservationValidator } from './network-observation.validator.js';

export function networkObservationRoutes(controller: NetworkObservationController): HttpRouteRegistration {
  const router = Router();
  router.post('/observations', validateRequestBody(networkObservationValidator), controller.record);
  return { basePath: '/v1/network', router };
}
