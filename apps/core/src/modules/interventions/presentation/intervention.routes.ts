import { Router } from 'express';
import type { HttpRouteRegistration } from '../../../api/http-route-registration.js';
import { validateRequestBody } from '../../../api/middleware/request-validation.middleware.js';
import { fraudConfirmationValidator } from './fraud-confirmation.validator.js';
import type { InterventionController } from './intervention.controller.js';

/** Exceptions around a policy hold. There is deliberately no route that lets an analyst release a hold. */
export function interventionRoutes(controller: InterventionController): HttpRouteRegistration {
  const router = Router();
  router.get('/:transactionId', controller.history);
  router.post('/:transactionId/customer-verified-release', controller.releaseAfterCustomerVerification);
  router.post('/:transactionId/customer-cancellation', controller.cancelByCustomer);
  router.post('/:transactionId/fraud-confirmation', validateRequestBody(fraudConfirmationValidator), controller.confirmFraud);
  return { basePath: '/v1/interventions', router };
}
