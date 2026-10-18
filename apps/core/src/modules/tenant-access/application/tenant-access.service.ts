import { isOwnTenant, type InstitutionId } from '@sentinel/domain';
import { ApplicationError } from '../../../platform/errors/application-error.js';
import type { AccountRepository } from '../../accounts/application/ports/account-repository.port.js';
import type { ActingContext, AuditTrail } from '../../audit/application/audit-trail.js';

export interface AccountOwnership {
  readonly accountId: string;
  readonly institutionId: InstitutionId;
  readonly displayReference?: string;
}

export interface AccessSubject {
  readonly accountId?: string;
  readonly caseId?: string;
  readonly transactionId?: string;
}

/**
 * The single server-side access boundary for the tenant lens (T§14). A lens may open its own institution's
 * accounts, cases, reports and interventions in full; another institution's are refused with a 403, and the
 * refusal is audited without the requested record's content. The operator view (no lens) is the single
 * synthetic deployment and sees everything.
 */
export class TenantAccessService {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly audit: AuditTrail,
  ) {}

  /** The account's owner, or NOT_FOUND. */
  async ownership(accountId: string): Promise<AccountOwnership> {
    const account = await this.accounts.findAccount(accountId);
    if (!account) throw new ApplicationError('NOT_FOUND', `Account ${accountId} is unknown`);
    return {
      accountId: account.id,
      institutionId: account.institutionId,
      ...(account.displayReference ? { displayReference: account.displayReference } : {}),
    };
  }

  /** Resolves the account and refuses (403, audited) when the lens belongs to another institution. */
  async authoriseAccount(context: ActingContext, accountId: string, purpose: string, subject: AccessSubject = {}): Promise<AccountOwnership> {
    const owner = await this.ownership(accountId);
    await this.authoriseInstitution(context, owner.institutionId, purpose, { accountId, ...subject });
    return owner;
  }

  async authoriseInstitution(context: ActingContext, institutionId: InstitutionId, purpose: string, subject: AccessSubject): Promise<void> {
    if (isOwnTenant(context.lens, institutionId)) return;
    await this.audit.record(context, {
      category: 'ACCESS',
      action: 'CROSS_TENANT_DENIED',
      outcome: 'DENIED',
      subject: { institutionId, ...subject },
      detail: purpose,
    });
    throw new ApplicationError('FORBIDDEN', `The ${context.lens ?? 'operator'} lens cannot open another institution's ${purpose}`);
  }
}
