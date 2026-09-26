import type { RequestHandler, Response } from 'express';

export type ValidationResult<TBody> =
  | { readonly valid: true; readonly value: TBody }
  | { readonly valid: false; readonly problems: readonly string[] };

/** Validation lives at the boundary; controllers receive a typed body or never run. */
export type RequestBodyValidator<TBody> = (body: unknown) => ValidationResult<TBody>;

export function validateRequestBody<TBody>(validator: RequestBodyValidator<TBody>): RequestHandler {
  return (request, response, next) => {
    const result = validator(request.body);
    if (!result.valid) {
      response.status(400).json({ error: 'invalid_request', problems: result.problems });
      return;
    }
    response.locals['validatedBody'] = result.value;
    next();
  };
}

export function validatedBodyOf<TBody>(response: Response): TBody {
  return response.locals['validatedBody'] as TBody;
}
