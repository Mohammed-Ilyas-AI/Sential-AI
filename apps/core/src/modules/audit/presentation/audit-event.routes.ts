import type { AuditEventCategory } from '@sentinel/domain';
import { Router, type RequestHandler } from 'express';
import type { HttpRouteRegistration } from '../../../api/http-route-registration.js';
import { lensOf } from '../../tenant-access/presentation/tenant-lens.middleware.js';
import type { AuditTrail } from '../application/audit-trail.js';

const CATEGORIES: readonly AuditEventCategory[] = ['CASE', 'CASE_REPORT', 'KILL_SWITCH', 'CUSTOMER_CONTACT', 'SCENARIO', 'ACCESS'];
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

/** Read-only: GET /v1/audit-events. There is no route that edits or deletes an audit event. */
export function auditEventRoutes(audit: AuditTrail): HttpRouteRegistration {
  const list: RequestHandler = async (request, response) => {
    const requested = Number(request.query['limit'] ?? DEFAULT_LIMIT);
    const limit = Number.isInteger(requested) && requested > 0 ? Math.min(requested, MAX_LIMIT) : DEFAULT_LIMIT;
    const category = typeof request.query['category'] === 'string' ? request.query['category'] : undefined;
    if (category !== undefined && !CATEGORIES.includes(category as AuditEventCategory)) {
      response.status(400).json({ error: 'invalid_request', problems: [{ field: 'category', problem: 'unknown category' }] });
      return;
    }
    const lens = lensOf(response);
    const events = await audit.list({
      limit,
      ...(category ? { category: category as AuditEventCategory } : {}),
      ...(lens ? { institutionId: lens } : {}),
    });
    response.status(200).json({ events, limit });
  };
  const router = Router();
  router.get('/', list);
  return { basePath: '/v1/audit-events', router };
}
