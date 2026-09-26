import type { FundTrace, GraphNeighbourhood, NetworkObservation } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';
import type { Collection } from 'mongodb';
import type { GraphRepository } from '../../../../modules/graph/application/ports/graph-repository.port.js';
import type { MongoDatabase } from '../client/mongo-connection.js';
import { entitiesCollection, type EntityDocument } from '../collections/entities.collection.js';
import { edgeIdentity, entityEdgesCollection, type EntityEdgeDocument } from '../collections/entity-edges.collection.js';

const STEP = 'scheduled for build order step 11';

export class MongoGraphRepository implements GraphRepository {
  private readonly entities: Collection<EntityDocument>;
  private readonly edges: Collection<EntityEdgeDocument>;

  constructor(database: MongoDatabase) {
    this.entities = database.collection<EntityDocument>(entitiesCollection.name);
    this.edges = database.collection<EntityEdgeDocument>(entityEdgesCollection.name);
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

  neighbourhood(): Promise<GraphNeighbourhood> {
    throw new NotYetImplementedError('MongoGraphRepository.neighbourhood', STEP);
  }

  traceFunds(): Promise<FundTrace> {
    throw new NotYetImplementedError('MongoGraphRepository.traceFunds', STEP);
  }
}
