import type { Case, CaseStatus, CaseSummary, InstitutionId, IsoTimestamp } from '@sentinel/domain';
import type { Collection } from 'mongodb';
import type { CaseRepository } from '../../../../modules/cases/application/ports/case-repository.port.js';
import { ApplicationError } from '../../../../platform/errors/application-error.js';
import type { IdempotentWriteResult } from '../../../../platform/idempotency/idempotent-write.js';
import type { MongoDatabase } from '../client/mongo-connection.js';
import { isDuplicateKeyError } from '../client/mongo-connection.js';
import { casesCollection, type CaseDocument } from '../collections/cases.collection.js';
import { withoutStorageFields } from '../serializers/document-identity.js';

export class MongoCaseRepository implements CaseRepository {
  private readonly cases: Collection<CaseDocument>;

  constructor(database: MongoDatabase) {
    this.cases = database.collection<CaseDocument>(casesCollection.name);
  }

  async open(investigationCase: Case): Promise<IdempotentWriteResult<Case>> {
    try {
      await this.cases.insertOne({ ...investigationCase, _id: investigationCase.id });
      return { outcome: 'CREATED', record: investigationCase };
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      const original = await this.cases.findOne({ alertIds: { $in: investigationCase.alertIds } });
      if (!original) throw error;
      return { outcome: 'DUPLICATE', record: withoutStorageFields(original) };
    }
  }

  async findById(caseId: string): Promise<Case | null> {
    const document = await this.cases.findOne({ _id: caseId });
    return document ? withoutStorageFields(document) : null;
  }

  async list(limit: number, institutionId?: InstitutionId): Promise<readonly Case[]> {
    const filter = institutionId ? { institutionId } : {};
    const documents = await this.cases.find(filter).sort({ openedAt: -1, _id: 1 }).limit(limit).toArray();
    return documents.map(withoutStorageFields);
  }

  async changeStatus(
    caseId: string,
    from: CaseStatus,
    to: CaseStatus,
    change: { readonly at: IsoTimestamp; readonly by: string },
  ): Promise<Case | null> {
    const update = await this.cases.updateOne(
      { _id: caseId, status: from },
      { $set: { status: to, updatedAt: change.at, ...(to === 'ESCALATED' ? { escalatedBy: change.by } : {}) } },
    );
    if (update.matchedCount === 0) return null;
    return this.findById(caseId);
  }

  async attachSummary(caseId: string, summary: CaseSummary): Promise<void> {
    const result = await this.cases.updateOne({ _id: caseId, aiSummary: { $exists: false } }, { $set: { aiSummary: summary } });
    if (result.matchedCount === 0) {
      const existing = await this.cases.findOne({ _id: caseId });
      if (!existing) throw new ApplicationError('NOT_FOUND', `No case ${caseId}`);
    }
  }
}
