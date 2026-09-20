import { Router } from 'express';

export const transactionsRouter: Router = Router();

// POST /api/transactions - ingest a transaction, score it, apply policy.
// TODO: validate against the shared schema, then hand to scoring + policy services.
transactionsRouter.post('/', (_req, res) => {
  res.status(501).json({ error: 'not_implemented', detail: 'ingest pipeline pending' });
});

// GET /api/transactions/stream - SSE feed of scored transactions for the live flow view.
transactionsRouter.get('/stream', (_req, res) => {
  res.status(501).json({ error: 'not_implemented', detail: 'SSE stream pending' });
});
