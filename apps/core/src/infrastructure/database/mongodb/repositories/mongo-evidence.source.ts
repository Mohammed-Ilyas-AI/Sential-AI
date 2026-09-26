import type {
  AccountProfile,
  AlertSummary,
  DeviceEvent,
  GraphNeighbourhood,
  Intervention,
  PayeeEvent,
  RecordedRiskAssessment,
  Transaction,
} from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';
import type { EvidenceSource } from '../../../../modules/investigations/application/ports/evidence-source.port.js';
import type { MongoDatabase } from '../client/mongo-connection.js';

const STEP = 'scheduled for build order step 10';

/** One read per evidence section; the document shape is why MongoDB suits this bundle. */
export class MongoEvidenceSource implements EvidenceSource {
  constructor(private readonly database: MongoDatabase) {}

  accountProfile(): Promise<AccountProfile> {
    throw new NotYetImplementedError('MongoEvidenceSource.accountProfile', STEP);
  }

  assessment(): Promise<RecordedRiskAssessment> {
    throw new NotYetImplementedError('MongoEvidenceSource.assessment', STEP);
  }

  recentTransactions(): Promise<readonly Transaction[]> {
    throw new NotYetImplementedError('MongoEvidenceSource.recentTransactions', STEP);
  }

  deviceHistory(): Promise<readonly DeviceEvent[]> {
    throw new NotYetImplementedError('MongoEvidenceSource.deviceHistory', STEP);
  }

  payeeHistory(): Promise<readonly PayeeEvent[]> {
    throw new NotYetImplementedError('MongoEvidenceSource.payeeHistory', STEP);
  }

  priorAlerts(): Promise<readonly AlertSummary[]> {
    throw new NotYetImplementedError('MongoEvidenceSource.priorAlerts', STEP);
  }

  interventions(): Promise<readonly Intervention[]> {
    throw new NotYetImplementedError('MongoEvidenceSource.interventions', STEP);
  }

  neighbourhood(): Promise<GraphNeighbourhood> {
    throw new NotYetImplementedError('MongoEvidenceSource.neighbourhood', STEP);
  }
}
