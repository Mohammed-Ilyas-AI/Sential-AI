import type { CaseReportVersion } from '@sentinel/domain';
import type { Collection } from 'mongodb';
import { ApplicationError } from '../../../../platform/errors/application-error.js';
import type { CaseReportRepository } from '../../../../modules/cases/application/ports/case-report-repository.port.js';
import type { MongoDatabase } from '../client/mongo-connection.js';
import { caseReportsCollection, type CaseReportDocument } from '../collections/operations.collections.js';
import { withoutStorageFields } from '../serializers/document-identity.js';
import { isDuplicateKeyError } from '../client/mongo-connection.js';

export class MongoCaseReportRepository implements CaseReportRepository {
  private readonly reports: Collection<CaseReportDocument>;

  constructor(database: MongoDatabase) {
    this.reports = database.collection<CaseReportDocument>(caseReportsCollection.name);
  }

  async insertVersion(version: CaseReportVersion): Promise<void> {
    try {
      // One document per version; the reportId is shared by every version of the same report.
      await this.reports.insertOne({ ...version, _id: `${version.caseId}:v${version.version}` });
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      throw new ApplicationError('CONFLICT', `Case ${version.caseId} report version ${version.version} already exists`);
    }
  }

  async versions(caseId: string): Promise<readonly CaseReportVersion[]> {
    const documents = await this.reports.find({ caseId }).sort({ version: 1 }).toArray();
    return documents.map(withoutStorageFields);
  }

  async replaceDraft(next: CaseReportVersion, expectedRevision: number): Promise<boolean> {
    const result = await this.reports.updateOne(
      { caseId: next.caseId, version: next.version, revision: expectedRevision, status: 'DRAFT' },
      { $set: next },
    );
    return result.modifiedCount === 1;
  }
}
