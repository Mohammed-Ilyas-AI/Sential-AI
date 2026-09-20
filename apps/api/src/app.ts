import express, { type Express } from 'express';
import { healthRouter } from './routes/health.js';
import { transactionsRouter } from './routes/transactions.js';
import { casesRouter } from './routes/cases.js';
import { errorHandler } from './middleware/error-handler.js';

export function createApp(): Express {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  app.use('/healthz', healthRouter);
  app.use('/api/transactions', transactionsRouter);
  app.use('/api/cases', casesRouter);

  app.use(errorHandler);
  return app;
}
