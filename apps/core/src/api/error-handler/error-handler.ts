import { NotYetImplementedError } from '@sentinel/domain';
import type { ErrorRequestHandler } from 'express';
import type { Logger } from '../../infrastructure/telemetry/logger.js';

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, _request, response, _next) => {
    if (error instanceof NotYetImplementedError) {
      response.status(501).json({ error: 'not_implemented', detail: error.message });
      return;
    }
    logger.error({ err: error, traceId: response.locals['traceId'] }, 'unhandled error');
    response.status(500).json({ error: 'internal_error' });
  };
}
