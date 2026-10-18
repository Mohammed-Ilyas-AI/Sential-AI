import { Router, type RequestHandler } from 'express';
import type { HttpRouteRegistration } from '../../../api/http-route-registration.js';
import { validatedBodyOf, validateRequestBody, type RequestBodyValidator } from '../../../api/middleware/request-validation.middleware.js';
import { FieldReader, isJsonObject, toValidationResult } from '../../../api/validation/field-reader.js';
import { actingContext } from '../../tenant-access/presentation/tenant-lens.middleware.js';
import type { ScenarioLaunchService } from '../application/scenario-launch.service.js';

interface LaunchBody {
  readonly analystIdentity: string;
  readonly idempotencyKey: string;
  readonly noise: { readonly seed: number; readonly ratePerMinute: number } | null;
}

const launchValidator: RequestBodyValidator<LaunchBody> = (body) => {
  const { reader, problems } = FieldReader.forBody(body);
  const rawNoise = isJsonObject(body) ? body['noise'] : undefined;
  let noise: LaunchBody['noise'] = null;
  if (rawNoise !== undefined && rawNoise !== null) {
    if (!isJsonObject(rawNoise)) problems.push('noise must be an object or null');
    else {
      const noiseReader = new FieldReader(rawNoise, problems, 'noise.');
      noise = { seed: noiseReader.integer('seed', 0), ratePerMinute: noiseReader.integer('ratePerMinute', 1) };
    }
  }
  return toValidationResult(problems, { analystIdentity: reader.string('analystIdentity'), idempotencyKey: reader.string('idempotencyKey'), noise });
};

/** Synthetic demo runs only. The browser sends a run request, never a command, job name or credential. */
export function scenarioRunRoutes(service: ScenarioLaunchService): HttpRouteRegistration {
  const capability: RequestHandler = (_request, response) => {
    response.status(200).json(service.capability());
  };
  const list: RequestHandler = async (_request, response) => {
    response.status(200).json({ runs: await service.list(10) });
  };
  const get: RequestHandler<{ runId: string }> = async (request, response) => {
    response.status(200).json(await service.get(request.params.runId));
  };
  const launch: RequestHandler = async (_request, response) => {
    const body = validatedBodyOf<LaunchBody>(response);
    const written = await service.launch(actingContext(response, 'ANALYST', body.analystIdentity), { idempotencyKey: body.idempotencyKey, noise: body.noise });
    response.status(written.outcome === 'CREATED' ? 202 : 200).json(written);
  };

  const router = Router();
  router.get('/capability', capability);
  router.get('/', list);
  router.post('/', validateRequestBody(launchValidator), launch);
  router.get('/:runId', get);
  return { basePath: '/v1/demo/scenario-runs', router };
}
