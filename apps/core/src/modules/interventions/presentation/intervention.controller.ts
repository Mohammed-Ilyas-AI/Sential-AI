import type { RequestHandler, Response } from 'express';
import { validatedBodyOf } from '../../../api/middleware/request-validation.middleware.js';
import type { InterventionActor } from '@sentinel/domain';
import type { TenantAccessService } from '../../tenant-access/application/tenant-access.service.js';
import { actingContext } from '../../tenant-access/presentation/tenant-lens.middleware.js';
import type { InterventionWorkflow } from '../application/intervention-workflow.use-case.js';
import type { FraudConfirmation } from './fraud-confirmation.validator.js';

type TransactionParameters = { transactionId: string };

export class InterventionController {
  constructor(
    private readonly workflow: InterventionWorkflow,
    private readonly access: TenantAccessService,
  ) {}

  readonly history: RequestHandler<TransactionParameters> = async (request, response) => {
    const history = await this.workflow.history(request.params.transactionId);
    const accountId = history[0]?.accountId;
    if (accountId) await this.authorise(response, 'ANALYST', accountId, request.params.transactionId);
    response.status(200).json({ transactionId: request.params.transactionId, history });
  };

  readonly releaseAfterCustomerVerification: RequestHandler<TransactionParameters> = async (request, response) => {
    await this.authoriseTransaction(response, 'CUSTOMER', request.params.transactionId);
    response.status(200).json(await this.workflow.releaseAfterCustomerVerification(request.params.transactionId));
  };

  readonly cancelByCustomer: RequestHandler<TransactionParameters> = async (request, response) => {
    await this.authoriseTransaction(response, 'CUSTOMER', request.params.transactionId);
    response.status(200).json(await this.workflow.cancelByCustomer(request.params.transactionId));
  };

  readonly confirmFraud: RequestHandler<TransactionParameters> = async (request, response) => {
    const { analystIdentity } = validatedBodyOf<FraudConfirmation>(response);
    await this.authoriseTransaction(response, 'ANALYST', request.params.transactionId, analystIdentity);
    response.status(200).json(await this.workflow.rejectAsConfirmedFraud(request.params.transactionId, analystIdentity));
  };

  /** A lens may act only on its own institution's holds. An unknown transaction falls through to the workflow's 404. */
  private async authoriseTransaction(response: Response, actor: InterventionActor, transactionId: string, actorIdentity?: string): Promise<void> {
    const accountId = (await this.workflow.history(transactionId))[0]?.accountId;
    if (accountId) await this.authorise(response, actor, accountId, transactionId, actorIdentity);
  }

  private async authorise(response: Response, actor: InterventionActor, accountId: string, transactionId: string, actorIdentity?: string): Promise<void> {
    await this.access.authoriseAccount(actingContext(response, actor, actorIdentity), accountId, 'intervention', { transactionId });
  }
}
