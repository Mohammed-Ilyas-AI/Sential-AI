import { Router, type RequestHandler } from 'express';
import type { HttpRouteRegistration } from '../../../api/http-route-registration.js';
import { validatedBodyOf, validateRequestBody, type RequestBodyValidator } from '../../../api/middleware/request-validation.middleware.js';
import { FieldReader, toValidationResult } from '../../../api/validation/field-reader.js';
import { actingContext } from '../../tenant-access/presentation/tenant-lens.middleware.js';
import type { LiveDemoService } from '../application/live-demo.service.js';

interface LiveDemoBody {
  readonly analystIdentity: string;
}

const liveDemoValidator: RequestBodyValidator<LiveDemoBody> = (body) => {
  const { reader, problems } = FieldReader.forBody(body);
  return toValidationResult(problems, { analystIdentity: reader.string('analystIdentity') });
};

/**
 * POST /v1/demo/live-demo answers when the synthetic scenario has finished (about 46 s), so the run keeps its
 * request, and its CPU, for its whole length. The browser watches the transfers arrive on the stream meanwhile.
 */
export function liveDemoRoutes(service: LiveDemoService): HttpRouteRegistration {
  const run: RequestHandler = async (_request, response) => {
    const body = validatedBodyOf<LiveDemoBody>(response);
    response.status(200).json(await service.run(actingContext(response, 'ANALYST', body.analystIdentity)));
  };
  const router = Router();
  router.post('/', validateRequestBody(liveDemoValidator), run);
  return { basePath: '/v1/demo/live-demo', router };
}
