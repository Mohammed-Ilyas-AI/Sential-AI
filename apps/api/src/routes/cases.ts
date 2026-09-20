import { Router } from 'express';

export const casesRouter: Router = Router();

casesRouter.get('/', (_req, res) => {
  res.status(501).json({ error: 'not_implemented' });
});

casesRouter.get('/:id', (_req, res) => {
  res.status(501).json({ error: 'not_implemented' });
});

// POST /api/cases/:id/decision - analyst hold / release, appended to the audit trail.
casesRouter.post('/:id/decision', (_req, res) => {
  res.status(501).json({ error: 'not_implemented' });
});
