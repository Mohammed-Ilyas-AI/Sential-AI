import type { RequestHandler } from 'express';
import { validatedBodyOf } from '../../../api/middleware/request-validation.middleware.js';
import type { InterventionWorkflow } from '../application/intervention-workflow.use-case.js';
import type { FraudConfirmation } from './fraud-confirmation.validator.js';

type TransactionParameters = { transactionId: string };

export class InterventionController {
  constructor(private readonly workflow: InterventionWorkflow) {}

  readonly history: RequestHandler<TransactionParameters> = async (request, response) => {
    const history = await this.workflow.history(request.params.transactionId);
    response.status(200).json({ transactionId: request.params.transactionId, history });
  };

  readonly releaseAfterCustomerVerification: RequestHandler<TransactionParameters> = async (request, response) => {
    response.status(200).json(await this.workflow.releaseAfterCustomerVerification(request.params.transactionId));
  };

  readonly cancelByCustomer: RequestHandler<TransactionParameters> = async (request, response) => {
    response.status(200).json(await this.workflow.cancelByCustomer(request.params.transactionId));
  };

  readonly confirmFraud: RequestHandler<TransactionParameters> = async (request, response) => {
    const { analystIdentity } = validatedBodyOf<FraudConfirmation>(response);
    response.status(200).json(await this.workflow.rejectAsConfirmedFraud(request.params.transactionId, analystIdentity));
  };
}
