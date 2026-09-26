import type { Router } from 'express';

/** A module's HTTP surface. Modules own their routes; the app factory only mounts them. */
export interface HttpRouteRegistration {
  readonly basePath: string;
  readonly router: Router;
}
