import type { ScenarioRun } from '@sentinel/domain';
import type { Collection } from 'mongodb';
import type { ScenarioRunRepository } from '../../../../modules/scenarios/application/ports/scenario-run-repository.port.js';
import type { IdempotentWriteResult } from '../../../../platform/idempotency/idempotent-write.js';
import { isDuplicateKeyError, type MongoDatabase } from '../client/mongo-connection.js';
import { scenarioRunsCollection, type ScenarioRunDocument } from '../collections/operations.collections.js';
import { withoutStorageFields } from '../serializers/document-identity.js';

const ACTIVE: readonly ScenarioRun['status'][] = ['LAUNCHING', 'RUNNING'];

/** A finished run is never updated again: progress only moves a LAUNCHING or RUNNING run. */
export class MongoScenarioRunRepository implements ScenarioRunRepository {
  private readonly runs: Collection<ScenarioRunDocument>;

  constructor(database: MongoDatabase) {
    this.runs = database.collection<ScenarioRunDocument>(scenarioRunsCollection.name);
  }

  async insert(run: ScenarioRun): Promise<IdempotentWriteResult<ScenarioRun>> {
    try {
      await this.runs.insertOne({ ...run, _id: run.runId });
      return { outcome: 'CREATED', record: run };
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      const original = await this.runs.findOne({ idempotencyKey: run.idempotencyKey });
      if (!original) throw error;
      return { outcome: 'DUPLICATE', record: withoutStorageFields(original) };
    }
  }

  async findById(runId: string): Promise<ScenarioRun | null> {
    const document = await this.runs.findOne({ _id: runId });
    return document ? withoutStorageFields(document) : null;
  }

  async findActive(): Promise<readonly ScenarioRun[]> {
    const documents = await this.runs.find({ status: { $in: [...ACTIVE] } }).sort({ requestedAt: -1 }).toArray();
    return documents.map(withoutStorageFields);
  }

  async list(limit: number): Promise<readonly ScenarioRun[]> {
    const documents = await this.runs.find({}).sort({ requestedAt: -1 }).limit(limit).toArray();
    return documents.map(withoutStorageFields);
  }

  async update(runId: string, patch: Parameters<ScenarioRunRepository['update']>[1]): Promise<ScenarioRun | null> {
    await this.runs.updateOne({ _id: runId, status: { $in: [...ACTIVE] } }, { $set: patch });
    return this.findById(runId);
  }
}
