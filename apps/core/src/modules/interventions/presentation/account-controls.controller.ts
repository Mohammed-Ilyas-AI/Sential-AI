import type { RequestHandler } from 'express';
import { validatedBodyOf } from '../../../api/middleware/request-validation.middleware.js';
import { ApplicationError } from '../../../platform/errors/application-error.js';
import { actingContext } from '../../tenant-access/presentation/tenant-lens.middleware.js';
import type { AccountControls } from '../application/account-controls.use-case.js';
import type { CustomerContactBody, CustomerVerificationBody, KillSwitchActivationBody } from './account-controls.validators.js';

type AccountParameters = { accountToken: string };

/** 201 for a new record, 200 for an idempotent replay of the same request. */
const statusFor = (outcome: 'CREATED' | 'DUPLICATE'): number => (outcome === 'CREATED' ? 201 : 200);

export class AccountControlsController {
  constructor(private readonly controls: AccountControls) {}

  readonly killSwitchStatus: RequestHandler<AccountParameters> = async (request, response) => {
    response.status(200).json(await this.controls.killSwitchStatus(actingContext(response, 'ANALYST'), request.params.accountToken));
  };

  readonly activateKillSwitch: RequestHandler<AccountParameters> = async (request, response) => {
    const body = validatedBodyOf<KillSwitchActivationBody>(response);
    if (body.confirmAccountId !== request.params.accountToken) {
      throw new ApplicationError('UNPROCESSABLE', 'The confirmation names a different account; nothing was switched off');
    }
    const written = await this.controls.activateKillSwitch(actingContext(response, 'ANALYST', body.analystIdentity), {
      accountId: request.params.accountToken,
      reason: body.reason,
      idempotencyKey: body.idempotencyKey,
    });
    response.status(statusFor(written.outcome)).json(written);
  };

  /** The simulated bank callback once the customer has verified with the bank: actor CUSTOMER, never ANALYST. */
  readonly liftAfterCustomerVerification: RequestHandler<AccountParameters> = async (request, response) => {
    const body = validatedBodyOf<CustomerVerificationBody>(response);
    const written = await this.controls.liftKillSwitchAfterCustomerVerification(
      actingContext(response, 'CUSTOMER'),
      request.params.accountToken,
      body.idempotencyKey,
    );
    response.status(statusFor(written.outcome)).json(written);
  };

  readonly contacts: RequestHandler<AccountParameters> = async (request, response) => {
    const contacts = await this.controls.contacts(actingContext(response, 'ANALYST'), request.params.accountToken);
    response.status(200).json({ accountId: request.params.accountToken, contacts });
  };

  readonly recordContact: RequestHandler<AccountParameters> = async (request, response) => {
    const body = validatedBodyOf<CustomerContactBody>(response);
    const written = await this.controls.recordContact(actingContext(response, 'ANALYST', body.analystIdentity), {
      accountId: request.params.accountToken,
      channel: body.channel,
      outcome: body.outcome,
      idempotencyKey: body.idempotencyKey,
      ...(body.note !== undefined ? { note: body.note } : {}),
      ...(body.transactionId !== undefined ? { transactionId: body.transactionId } : {}),
      ...(body.caseId !== undefined ? { caseId: body.caseId } : {}),
    });
    response.status(statusFor(written.outcome)).json(written);
  };
}
