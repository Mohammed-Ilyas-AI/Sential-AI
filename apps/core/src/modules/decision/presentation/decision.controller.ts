import type { DecisionRequest } from '@sentinel/domain';
import type { RequestHandler } from 'express';
import { traceIdOf } from '../../../api/middleware/correlation-id.middleware.js';
import { validatedBodyOf } from '../../../api/middleware/request-validation.middleware.js';
import type { DecideTransaction } from '../application/decide-transaction.use-case.js';

/** HTTP only: typed body in, DecisionResponse out. */
export class DecisionController {
  constructor(private readonly decideTransaction: DecideTransaction) {}

  readonly decide: RequestHandler = async (_request, response) => {
    const decision = await this.decideTransaction.decide(validatedBodyOf<DecisionRequest>(response), traceIdOf(response));
    response.status(200).json(decision);
  };
}
