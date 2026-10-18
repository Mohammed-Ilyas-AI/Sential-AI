import type { GraphEdge, NetworkObservation } from '@sentinel/domain';
import type { Collection } from 'mongodb';
import type { GraphRepository, StoredGraphNode } from '../../../../modules/graph/application/ports/graph-repository.port.js';
import type { MongoDatabase } from '../client/mongo-connection.js';
import { accountsCollection, type AccountDocument } from '../collections/accounts.collection.js';
import { entitiesCollection, type EntityDocument } from '../collections/entities.collection.js';
import { edgeIdentity, entityEdgesCollection, type EntityEdgeDocument } from '../collections/entity-edges.collection.js';
import { transactionsCollection, type TransactionProjectionDocument } from '../collections/transactions.collection.js';
import { withoutStorageFields } from '../serializers/document-identity.js';

const MOVED_STATUSES = ['AUTHORISED', 'SETTLED'] as const;

interface OwnTransferGroup {
  readonly _id: string;
  readonly weight: number;
  readonly firstSeen: string;
  readonly lastSeen: string;
  readonly institutionId: string;
}

/**
 * `entities` and `entity_edges` by the indexed {from} and {to}, and the account's own moved transfers by the
 * indexed {sourceAccountId, ts}. Every read is bounded; the traversal itself is in GraphService.
 */
export class MongoGraphRepository implements GraphRepository {
  private readonly entities: Collection<EntityDocument>;
  private readonly edges: Collection<EntityEdgeDocument>;
  private readonly accounts: Collection<AccountDocument>;
  private readonly transactions: Collection<TransactionProjectionDocument>;

  constructor(database: MongoDatabase) {
    this.entities = database.collection<EntityDocument>(entitiesCollection.name);
    this.edges = database.collection<EntityEdgeDocument>(entityEdgesCollection.name);
    this.accounts = database.collection<AccountDocument>(accountsCollection.name);
    this.transactions = database.collection<TransactionProjectionDocument>(transactionsCollection.name);
  }

  async recordObservation(observation: NetworkObservation): Promise<void> {
    if (observation.nodes.length > 0) {
      await this.entities.bulkWrite(
        observation.nodes.map((node) => ({
          replaceOne: { filter: { _id: node.id }, replacement: node, upsert: true },
        })),
      );
    }
    if (observation.edges.length > 0) {
      await this.edges.bulkWrite(
        observation.edges.map((edge) => ({
          replaceOne: { filter: { _id: edgeIdentity(edge) }, replacement: edge, upsert: true },
        })),
      );
    }
  }

  async edgesTouching(ids: readonly string[], limit: number): Promise<readonly GraphEdge[]> {
    if (ids.length === 0) return [];
    const documents = await this.edges
      .find({ $or: [{ from: { $in: [...ids] } }, { to: { $in: [...ids] } }] })
      .sort({ weight: -1, _id: 1 })
      .limit(limit)
      .toArray();
    return documents.map(withoutStorageFields);
  }

  async transfersFrom(ids: readonly string[]): Promise<readonly GraphEdge[]> {
    if (ids.length === 0) return [];
    const documents = await this.edges.find({ from: { $in: [...ids] }, kind: 'TRANSFERRED_TO' }).toArray();
    return documents.map(withoutStorageFields);
  }

  async ownTransfersFrom(accountId: string): Promise<readonly GraphEdge[]> {
    const groups = await this.transactions
      .aggregate<OwnTransferGroup>([
        { $match: { sourceAccountId: accountId, status: { $in: [...MOVED_STATUSES] } } },
        { $sort: { ts: 1 } },
        {
          $group: {
            _id: '$destAccountId',
            weight: { $sum: '$amount' },
            firstSeen: { $first: '$ts' },
            lastSeen: { $last: '$ts' },
            institutionId: { $first: '$institutionId' },
          },
        },
      ])
      .toArray();
    return groups.map(
      (group): GraphEdge => ({
        from: accountId,
        to: group._id,
        kind: 'TRANSFERRED_TO',
        weight: group.weight,
        firstSeen: group.firstSeen,
        lastSeen: group.lastSeen,
        evidence: {
          sourceInstitution: group.institutionId,
          evidenceType: 'PAYMENT_EVENT',
          observedAt: group.lastSeen,
          tenantScope: 'OWN',
          linkage: 'DIRECT',
          scoring: 'CONFIRMED',
        },
      }),
    );
  }

  async nodes(ids: readonly string[]): Promise<readonly StoredGraphNode[]> {
    if (ids.length === 0) return [];
    const [entities, accounts] = await Promise.all([
      this.entities.find({ _id: { $in: [...ids] } }).toArray(),
      this.accounts.find({ _id: { $in: [...ids] } }, { projection: { _id: 1, institutionId: 1, displayReference: 1 } }).toArray(),
    ]);
    const entityById = new Map(entities.map((entity) => [entity._id, withoutStorageFields(entity)]));
    const accountById = new Map(accounts.map((account) => [account._id, account]));
    const accountOnly = ids.filter((id) => !entityById.has(id) && accountById.has(id));
    const counts = accountOnly.length
      ? await this.transactions
          .aggregate<{ readonly _id: string; readonly count: number }>([
            { $match: { sourceAccountId: { $in: accountOnly } } },
            { $group: { _id: '$sourceAccountId', count: { $sum: 1 } } },
          ])
          .toArray()
      : [];
    const countById = new Map(counts.map((count) => [count._id, count.count]));
    // A destination this bank paid but never observed as an entity: its institution is on the payment record.
    const unseen = ids.filter((id) => !entityById.has(id) && !accountById.has(id));
    const destinations = unseen.length
      ? await this.transactions
          .aggregate<{ readonly _id: string; readonly institutionId: string; readonly count: number }>([
            { $match: { destAccountId: { $in: unseen } } },
            { $group: { _id: '$destAccountId', institutionId: { $first: '$destInstitutionId' }, count: { $sum: 1 } } },
          ])
          .toArray()
      : [];
    const destinationById = new Map(destinations.map((destination) => [destination._id, destination]));

    return ids.flatMap((id): StoredGraphNode[] => {
      const account = accountById.get(id);
      const reference = account?.displayReference ? { displayReference: account.displayReference } : {};
      const entity = entityById.get(id);
      if (entity) return [{ ...entity, ...reference }];
      if (!account) {
        const destination = destinationById.get(id);
        return destination
          ? [{ id, kind: 'ACCOUNT', institutionId: destination.institutionId, flagged: false, riskIndicators: [], txCount: destination.count }]
          : [];
      }
      return [{ id, kind: 'ACCOUNT', institutionId: account.institutionId, flagged: false, riskIndicators: [], txCount: countById.get(id) ?? 0, ...reference }];
    });
  }
}
