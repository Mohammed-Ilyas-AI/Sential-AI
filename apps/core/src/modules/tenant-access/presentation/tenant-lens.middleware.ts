import { TENANT_LENS_HEADER, parseTenantLens, type InterventionActor, type TenantLens } from '@sentinel/domain';
import type { RequestHandler, Response } from 'express';
import { traceIdOf } from '../../../api/middleware/correlation-id.middleware.js';
import type { ActingContext } from '../../audit/application/audit-trail.js';

/** Reads the lens header once per request. An unknown institution is a 400, never a silent operator view. */
export function tenantLens(): RequestHandler {
  return (request, response, next) => {
    const lens = parseTenantLens(request.header(TENANT_LENS_HEADER));
    if (lens === 'INVALID') {
      response.status(400).json({ error: 'invalid_lens', detail: `${TENANT_LENS_HEADER} must name a participating institution` });
      return;
    }
    response.locals['lens'] = lens;
    next();
  };
}

export function lensOf(response: Response): TenantLens {
  const lens: unknown = response.locals['lens'];
  return typeof lens === 'string' ? lens : null;
}

/** The acting context for an audited use case: trace, lens and, for analysts, the recorded identity. */
export function actingContext(response: Response, actor: InterventionActor, actorIdentity?: string): ActingContext {
  return { traceId: traceIdOf(response), actor, lens: lensOf(response), ...(actorIdentity ? { actorIdentity } : {}) };
}
