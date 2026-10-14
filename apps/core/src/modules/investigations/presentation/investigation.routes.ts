import { Router } from 'express';
import type { HttpRouteRegistration } from '../../../api/http-route-registration.js';
import type { InvestigationController } from './investigation.controller.js';

/**
 * The intelligence path's HTTP surface. A FALLBACK outcome is a 200: the explanation is optional, the
 * deterministic attribution is not, and no response here can alter a score, a decision or a hold.
 */
export function investigationRoutes(controller: InvestigationController): HttpRouteRegistration {
  const router = Router();
  router.get('/:assessmentId/evidence', controller.evidence);
  router.post('/:assessmentId/explanation', controller.explain);
  router.post('/:assessmentId/case-summary', controller.summarise);
  router.post('/:assessmentId/agent-investigation', controller.investigate);
  return { basePath: '/v1/investigations', router };
}
