import express, { type Express } from 'express';
import { performance } from 'node:perf_hooks';
import { createErrorHandler } from './api/error-handler/error-handler.js';
import { healthRouter } from './api/health/health.routes.js';
import type { HttpRouteRegistration } from './api/http-route-registration.js';
import { correlationId } from './api/middleware/correlation-id.middleware.js';
import { corsForOrigins } from './api/middleware/cors.middleware.js';
import { tenantLens } from './modules/tenant-access/presentation/tenant-lens.middleware.js';
import { measuredPath, type PerformanceMetrics } from './modules/telemetry/application/performance-metrics.js';
import type { Logger } from './infrastructure/telemetry/logger.js';

export interface CoreHttpDependencies {
  readonly routes: readonly HttpRouteRegistration[];
  readonly corsAllowedOrigins: readonly string[];
  readonly logger: Logger;
  readonly performanceMetrics: PerformanceMetrics;
}

export function createApp({ routes, corsAllowedOrigins, logger, performanceMetrics }: CoreHttpDependencies): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(corsForOrigins(corsAllowedOrigins));
  app.use(correlationId());
  app.use(tenantLens());
  app.use((request, response, next) => {
    const path = measuredPath(request.method, request.path);
    if (path) {
      const startedAt = performance.now();
      response.once('finish', () => performanceMetrics.record(path, performance.now() - startedAt, response.statusCode));
    }
    next();
  });
  app.use(express.json({ limit: '256kb' }));

  app.use('/healthz', healthRouter);
  for (const { basePath, router } of routes) app.use(basePath, router);

  app.use((_request, response) => {
    response.status(404).json({ error: 'not_found' });
  });
  app.use(createErrorHandler(logger));
  return app;
}
