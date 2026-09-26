import express, { type Express } from 'express';
import { createErrorHandler } from './api/error-handler/error-handler.js';
import { healthRouter } from './api/health/health.routes.js';
import type { HttpRouteRegistration } from './api/http-route-registration.js';
import { correlationId } from './api/middleware/correlation-id.middleware.js';
import { corsForOrigin } from './api/middleware/cors.middleware.js';
import type { Logger } from './infrastructure/telemetry/logger.js';

export interface CoreHttpDependencies {
  readonly routes: readonly HttpRouteRegistration[];
  readonly corsAllowedOrigin: string;
  readonly logger: Logger;
}

export function createApp({ routes, corsAllowedOrigin, logger }: CoreHttpDependencies): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(corsForOrigin(corsAllowedOrigin));
  app.use(correlationId());
  app.use(express.json({ limit: '256kb' }));

  app.use('/healthz', healthRouter);
  for (const { basePath, router } of routes) app.use(basePath, router);

  app.use((_request, response) => {
    response.status(404).json({ error: 'not_found' });
  });
  app.use(createErrorHandler(logger));
  return app;
}
