import { Router } from 'express';
import type { HttpRouteRegistration } from '../../../api/http-route-registration.js';
import type { PerformanceMetrics } from '../application/performance-metrics.js';

export function performanceRoutes(metrics: PerformanceMetrics): HttpRouteRegistration {
  const router = Router();
  router.get('/performance', (_request, response) => {
    response.status(200).json(metrics.snapshot());
  });
  return { basePath: '/v1/metrics', router };
}
