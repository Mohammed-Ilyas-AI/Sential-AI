import type { HttpInterceptorFn } from '@angular/common/http';

/** Every request carries a trace id that joins browser, sentinel-core logs and the audit trail. */
export const traceIdInterceptor: HttpInterceptorFn = (request, next) =>
  next(request.clone({ setHeaders: { 'X-Trace-Id': crypto.randomUUID() } }));
