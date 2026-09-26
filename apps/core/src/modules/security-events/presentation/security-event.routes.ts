import { Router } from 'express';
import type { HttpRouteRegistration } from '../../../api/http-route-registration.js';
import { validateRequestBody } from '../../../api/middleware/request-validation.middleware.js';
import { accountSecurityEventValidator } from './account-security-event.validator.js';
import type { SecurityEventController } from './security-event.controller.js';

export function securityEventRoutes(controller: SecurityEventController): HttpRouteRegistration {
  const router = Router();
  router.post('/security', validateRequestBody(accountSecurityEventValidator), controller.record);
  return { basePath: '/v1/events', router };
}
