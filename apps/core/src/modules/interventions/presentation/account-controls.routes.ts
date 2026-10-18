import { Router } from 'express';
import type { HttpRouteRegistration } from '../../../api/http-route-registration.js';
import { validateRequestBody } from '../../../api/middleware/request-validation.middleware.js';
import type { AccountControlsController } from './account-controls.controller.js';
import { customerContactValidator, customerVerificationValidator, killSwitchActivationValidator } from './account-controls.validators.js';

/**
 * Account-level exceptions: the kill switch and customer contact. There is deliberately no route that lets an
 * analyst lift the kill switch; only the customer-verification callback does.
 */
export function accountControlsRoutes(controller: AccountControlsController): HttpRouteRegistration {
  const router = Router();
  router.get('/:accountToken/kill-switch', controller.killSwitchStatus);
  router.post('/:accountToken/kill-switch', validateRequestBody(killSwitchActivationValidator), controller.activateKillSwitch);
  router.post(
    '/:accountToken/kill-switch/customer-verified-release',
    validateRequestBody(customerVerificationValidator),
    controller.liftAfterCustomerVerification,
  );
  router.get('/:accountToken/customer-contacts', controller.contacts);
  router.post('/:accountToken/customer-contacts', validateRequestBody(customerContactValidator), controller.recordContact);
  return { basePath: '/v1/accounts', router };
}
