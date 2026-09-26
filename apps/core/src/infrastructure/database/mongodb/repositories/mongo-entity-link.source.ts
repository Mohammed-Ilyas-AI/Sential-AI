import type { EdgeLinkage } from '@sentinel/domain';
import { flaggedLinksWithinTwoHops } from '@sentinel/rules';
import type { Collection } from 'mongodb';
import type { EntityLinkSource } from '../../../../modules/risk/application/ports/entity-link-source.port.js';
import type { MongoDatabase } from '../client/mongo-connection.js';
import { entitiesCollection, type EntityDocument } from '../collections/entities.collection.js';
import { entityEdgesCollection, type EntityEdgeDocument } from '../collections/entity-edges.collection.js';
import { withoutStorageFields } from '../serializers/document-identity.js';

/** Two indexed hops over entity_edges, then the flagged entities among them. Read-only. */
export class MongoEntityLinkSource implements EntityLinkSource {
  private readonly entities: Collection<EntityDocument>;
  private readonly edges: Collection<EntityEdgeDocument>;

  constructor(database: MongoDatabase) {
    this.entities = database.collection<EntityDocument>(entitiesCollection.name);
    this.edges = database.collection<EntityEdgeDocument>(entityEdgesCollection.name);
  }

  async flaggedLinksFor(destinationToken: string): Promise<readonly EdgeLinkage[]> {
    const firstHop = await this.edges.find({ $or: [{ from: destinationToken }, { to: destinationToken }] }).toArray();
    if (firstHop.length === 0) return [];
    const neighbours = [...new Set(firstHop.map((edge) => (edge.from === destinationToken ? edge.to : edge.from)))];
    const secondHop = await this.edges.find({ $or: [{ from: { $in: neighbours } }, { to: { $in: neighbours } }] }).toArray();

    const edges = [...new Map([...firstHop, ...secondHop].map((edge) => [edge._id, withoutStorageFields(edge)])).values()];
    const candidates = [...new Set(edges.flatMap((edge) => [edge.from, edge.to]))].filter((id) => id !== destinationToken);
    const flagged = await this.entities.find({ _id: { $in: candidates }, flagged: true }, { projection: { _id: 1 } }).toArray();
    return flaggedLinksWithinTwoHops(destinationToken, edges, new Set(flagged.map((entity) => entity._id)));
  }
}
