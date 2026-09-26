import type { RequestHandler } from 'express';

/** CORS restricted to the deployed UI origin. */
export function corsForOrigin(allowedOrigin: string): RequestHandler {
  return (request, response, next) => {
    if (request.headers.origin === allowedOrigin) {
      response.setHeader('Access-Control-Allow-Origin', allowedOrigin);
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Trace-Id');
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST');
      response.setHeader('Vary', 'Origin');
    }
    if (request.method === 'OPTIONS') {
      response.sendStatus(204);
      return;
    }
    next();
  };
}
