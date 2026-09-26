import type { FundTrace, GraphNeighbourhood } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';
import type { Collection } from 'mongodb';
import type { GraphRepository } from '../../../../modules/graph/application/ports/graph-repository.port.js';
import type { MongoDatabase } from '../client/mongo-connection.js';
import { entitiesCollection, type EntityDocument } from '../collections/entities.collection.js';
import { entityEdgesCollection, type EntityEdgeDocument } from '../collections/entity-edges.collection.js';

const STEP = 'scheduled for build order step 11';

/** $graphLookup with maxDepth 1, capped at 40 nodes and 120 edges, ranked by edge weight, cached per root. */
export class MongoGraphRepository implements GraphRepository {
  private readonly entities: Collection<EntityDocument>;
  private readonly edges: Collection<EntityEdgeDocument>;

  constructor(database: MongoDatabase) {
    this.entities = database.collection<EntityDocument>(entitiesCollection.name);
    this.edges = database.collection<EntityEdgeDocument>(entityEdgesCollection.name);
  }

  neighbourhood(): Promise<GraphNeighbourhood> {
    throw new NotYetImplementedError('MongoGraphRepository.neighbourhood', STEP);
  }

  traceFunds(): Promise<FundTrace> {
    throw new NotYetImplementedError('MongoGraphRepository.traceFunds', STEP);
  }
}
