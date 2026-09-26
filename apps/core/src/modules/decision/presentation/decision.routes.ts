import { Router } from 'express';
import type { HttpRouteRegistration } from '../../../api/http-route-registration.js';
import { validateRequestBody } from '../../../api/middleware/request-validation.middleware.js';
import type { DecisionController } from './decision.controller.js';
import { decisionRequestValidator } from './decision-request.validator.js';

export function decisionRoutes(controller: DecisionController): HttpRouteRegistration {
  const router = Router();
  router.post('/transactions', validateRequestBody(decisionRequestValidator), controller.decide);
  return { basePath: '/v1/decision', router };
}
