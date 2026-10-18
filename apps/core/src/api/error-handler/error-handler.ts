import { NotYetImplementedError } from '@sentinel/domain';
import type { ErrorRequestHandler } from 'express';
import type { Logger } from '../../infrastructure/telemetry/logger.js';
import { ApplicationError, type ApplicationErrorKind } from '../../platform/errors/application-error.js';

const STATUS_BY_KIND: Readonly<Record<ApplicationErrorKind, number>> = {
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  UNAUTHORISED: 401,
  FORBIDDEN: 403,
};

const isBodyParseError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.parse.failed';

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, _request, response, _next) => {
    if (error instanceof ApplicationError) {
      response.status(STATUS_BY_KIND[error.kind]).json({ error: error.kind.toLowerCase(), detail: error.message });
      return;
    }
    if (isBodyParseError(error)) {
      response.status(400).json({ error: 'invalid_json' });
      return;
    }
    if (error instanceof NotYetImplementedError) {
      response.status(501).json({ error: 'not_implemented', detail: error.message });
      return;
    }
    logger.error({ err: error, traceId: response.locals['traceId'] }, 'unhandled error');
    response.status(500).json({ error: 'internal_error' });
  };
}
