import type { Intervention } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';
import type { IdGenerator } from '../../../platform/ids/id-generator.js';
import type { Clock } from '../../../platform/time/clock.js';
import type { InterventionWorkflow } from './intervention-workflow.use-case.js';
import type { CustomerNotificationPublisher } from './ports/customer-notification.port.js';
import type { InterventionRepository } from './ports/intervention-repository.port.js';

const STEP = 'scheduled for build order step 7';

export class InterventionService implements InterventionWorkflow {
  constructor(
    private readonly interventions: InterventionRepository,
    private readonly notifications: CustomerNotificationPublisher,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  placeHold(): Promise<Intervention> {
    throw new NotYetImplementedError('Automatic hold', STEP);
  }

  releaseAfterCoolingPeriod(): Promise<Intervention> {
    throw new NotYetImplementedError('Auto-release after the 24-hour cooling period', STEP);
  }

  releaseAfterCustomerVerification(): Promise<Intervention> {
    throw new NotYetImplementedError('Expedited release after customer verification', STEP);
  }

  cancelByCustomer(): Promise<Intervention> {
    throw new NotYetImplementedError('Customer cancellation', STEP);
  }

  rejectAsConfirmedFraud(): Promise<Intervention> {
    throw new NotYetImplementedError('Analyst fraud confirmation', STEP);
  }
}
