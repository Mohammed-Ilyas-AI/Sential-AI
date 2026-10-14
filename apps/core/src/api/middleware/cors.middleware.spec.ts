import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { corsForOrigins } from './cors.middleware.js';

function call(origin: string | undefined, method = 'GET') {
  const headers: Record<string, string> = {};
  const response = {
    setHeader: (name: string, value: string) => void (headers[name] = value),
    sendStatus: vi.fn(),
  } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction;
  corsForOrigins(['https://a.run.app', 'https://sentinel.example.run'])({ headers: { origin }, method } as Request, response, next);
  return { headers, response, next };
}

describe('corsForOrigins', () => {
  it('echoes whichever configured origin made the request, never a wildcard', () => {
    expect(call('https://a.run.app').headers['Access-Control-Allow-Origin']).toBe('https://a.run.app');
    expect(call('https://sentinel.example.run').headers['Access-Control-Allow-Origin']).toBe('https://sentinel.example.run');
    expect(call('https://sentinel.example.run').headers['Vary']).toBe('Origin');
  });

  it('grants nothing to any other origin, or to a look-alike', () => {
    expect(call('https://evil.test').headers['Access-Control-Allow-Origin']).toBeUndefined();
    expect(call('https://sentinel.example.run.evil.test').headers['Access-Control-Allow-Origin']).toBeUndefined();
    expect(call(undefined).headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('answers a preflight without reaching the routes', () => {
    const { response, next } = call('https://a.run.app', 'OPTIONS');
    expect(response.sendStatus).toHaveBeenCalledWith(204);
    expect(next).not.toHaveBeenCalled();
  });
});
