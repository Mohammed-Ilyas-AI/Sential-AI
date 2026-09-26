import type { RequestHandler, Response } from 'express';
import { resolveTraceId, type TraceId } from '../../platform/correlation/trace-id.js';

export const TRACE_ID_HEADER = 'x-trace-id';

export function correlationId(): RequestHandler {
  return (request, response, next) => {
    const traceId = resolveTraceId(request.header(TRACE_ID_HEADER));
    response.locals['traceId'] = traceId;
    response.setHeader(TRACE_ID_HEADER, traceId);
    next();
  };
}

export function traceIdOf(response: Response): TraceId {
  return String(response.locals['traceId']);
}
