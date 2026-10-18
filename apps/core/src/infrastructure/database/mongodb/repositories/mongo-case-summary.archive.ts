import type { Collection } from 'mongodb';
import type { ArchivedCaseSummary, CaseSummaryArchive } from '../../../../modules/investigations/application/ports/case-summary-archive.port.js';
import type { MongoDatabase } from '../client/mongo-connection.js';
import { caseSummariesCollection, type CaseSummaryArchiveDocument } from '../collections/operations.collections.js';
import { isDuplicateKeyError } from '../client/mongo-connection.js';
import { withoutStorageFields } from '../serializers/document-identity.js';

export class MongoCaseSummaryArchive implements CaseSummaryArchive {
  private readonly summaries: Collection<CaseSummaryArchiveDocument>;

  constructor(database: MongoDatabase) {
    this.summaries = database.collection<CaseSummaryArchiveDocument>(caseSummariesCollection.name);
  }

  async find(assessmentId: string): Promise<ArchivedCaseSummary | null> {
    const document = await this.summaries.findOne({ _id: assessmentId });
    return document ? withoutStorageFields(document) : null;
  }

  async store(archived: ArchivedCaseSummary): Promise<void> {
    try {
      await this.summaries.insertOne({ ...archived, _id: archived.assessmentId });
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      const existing = await this.summaries.findOne({ _id: archived.assessmentId });
      if (!existing) throw error;
    }
  }
}
