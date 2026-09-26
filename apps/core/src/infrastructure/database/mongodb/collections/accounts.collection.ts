import type { Account, AccountState, IsoTimestamp, RollingWindow } from '@sentinel/domain';
import type { CollectionDefinition, MongoDocument } from './collection-definition.js';

/** Hot state, the cached drain window (invalidated on every outflow), known devices and payees. */
export type AccountDocument = MongoDocument<
  Account & {
    readonly securityState: AccountState;
    readonly cachedWindow?: RollingWindow & { readonly computedAt: IsoTimestamp };
  }
>;

export const accountsCollection: CollectionDefinition = {
  name: 'accounts',
  indexes: [{ key: { institutionId: 1, protected: 1 }, name: 'institutionId_protected' }],
};
