import { Router } from 'express';
import type { HttpRouteRegistration } from '../../../api/http-route-registration.js';
import { validateRequestBody } from '../../../api/middleware/request-validation.middleware.js';
import type { CaseController } from './case.controller.js';
import { analystValidator, editReportValidator, openCaseValidator, revisionValidator, signOffReportValidator } from './case.validators.js';

export function caseRoutes(controller: CaseController): HttpRouteRegistration {
  const router = Router();
  router.get('/', controller.list);
  router.post('/', validateRequestBody(openCaseValidator), controller.open);
  router.get('/:caseId', controller.get);
  router.post('/:caseId/escalate', validateRequestBody(analystValidator), controller.escalate);
  router.get('/:caseId/report', controller.report);
  router.post('/:caseId/report', validateRequestBody(analystValidator), controller.generateReport);
  router.get('/:caseId/report/:version/export', controller.exportReport);
  router.patch('/:caseId/report/:version', validateRequestBody(editReportValidator), controller.editReport);
  router.post('/:caseId/report/:version/sign-off', validateRequestBody(signOffReportValidator), controller.signOff);
  router.post('/:caseId/report/revision', validateRequestBody(revisionValidator), controller.startRevision);
  return { basePath: '/v1/cases', router };
}
