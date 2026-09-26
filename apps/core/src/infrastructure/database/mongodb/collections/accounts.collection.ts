import type { Account, AccountState, TenantId } from '@sentinel/domain';
import type { CollectionDefinition, MongoDocument } from './collection-definition.js';

/** The bank-reported account plus its security state, which stays separate from financial transaction state. */
export type AccountDocument = MongoDocument<
  Account & {
    readonly tenantId: TenantId;
    readonly securityState?: AccountState;
  }
>;

export const accountsCollection: CollectionDefinition = {
  name: 'accounts',
  indexes: [{ key: { institutionId: 1, protected: 1 }, name: 'institutionId_protected' }],
};
