import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TENANT_LENS_HEADER } from '@sentinel/domain';
import { RUNTIME_CONFIG } from '../../config/runtime-config';
import { TenantLensPreference } from '../../tenancy/tenant-lens';

/** Requests to sentinel-core carry the selected data lens; the server decides what that lens may see. */
export const tenantLensInterceptor: HttpInterceptorFn = (request, next) => {
  const lens = inject(TenantLensPreference).lens();
  const coreBase = inject(RUNTIME_CONFIG).coreApiBaseUrl;
  if (!lens || !request.url.startsWith(coreBase)) return next(request);
  return next(request.clone({ setHeaders: { [TENANT_LENS_HEADER]: lens } }));
};
