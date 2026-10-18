import type { RequestHandler } from 'express';

/** CORS restricted to the deployed UI's exact origins; the matching origin is echoed, never a wildcard. */
export function corsForOrigins(allowedOrigins: readonly string[]): RequestHandler {
  const allowed = new Set(allowedOrigins);
  return (request, response, next) => {
    const origin = request.headers.origin;
    if (origin !== undefined && allowed.has(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Trace-Id, X-Sentinel-Lens');
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT');
      response.setHeader('Vary', 'Origin');
    }
    if (request.method === 'OPTIONS') {
      response.sendStatus(204);
      return;
    }
    next();
  };
}
