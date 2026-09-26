import type { AccountSecurityEvent } from '@sentinel/domain';
import type { CollectionDefinition, MongoDocument } from './collection-definition.js';

export type SecurityEventDocument = MongoDocument<AccountSecurityEvent>;

export const securityEventsCollection: CollectionDefinition = {
  name: 'security_events',
  indexes: [
    { key: { idempotencyKey: 1 }, name: 'idempotencyKey_unique', unique: true },
    { key: { accountToken: 1, occurredAt: -1 }, name: 'accountToken_occurredAt' },
  ],
};
