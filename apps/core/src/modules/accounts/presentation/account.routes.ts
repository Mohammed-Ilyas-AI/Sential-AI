import { Router } from 'express';
import type { HttpRouteRegistration } from '../../../api/http-route-registration.js';
import { validateRequestBody } from '../../../api/middleware/request-validation.middleware.js';
import type { AccountController } from './account.controller.js';
import { bankAccountReportValidator } from './bank-account-report.validator.js';

export function accountRoutes(controller: AccountController): HttpRouteRegistration {
  const router = Router();
  router.put('/:accountToken', validateRequestBody(bankAccountReportValidator), controller.report);
  return { basePath: '/v1/accounts', router };
}
