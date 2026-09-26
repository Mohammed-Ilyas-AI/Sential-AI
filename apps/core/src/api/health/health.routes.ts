import { Router } from 'express';

export const healthRouter: Router = Router();

healthRouter.get('/', (_request, response) => {
  response.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) });
});
