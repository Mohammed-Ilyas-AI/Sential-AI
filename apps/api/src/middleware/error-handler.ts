import type { ErrorRequestHandler } from 'express';
import { logger } from '../logger.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  logger.error({ err }, 'unhandled error');
  res.status(500).json({ error: 'internal_error' });
};
