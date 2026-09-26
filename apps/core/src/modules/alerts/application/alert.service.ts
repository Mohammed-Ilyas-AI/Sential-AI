import type { Alert } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';
import type { IdGenerator } from '../../../platform/ids/id-generator.js';
import type { AlertRepository } from './ports/alert-repository.port.js';
import type { RaiseAlert } from './raise-alert.use-case.js';

export class AlertService implements RaiseAlert {
  constructor(
    private readonly alerts: AlertRepository,
    private readonly ids: IdGenerator,
  ) {}

  raiseFor(): Promise<Alert | null> {
    throw new NotYetImplementedError('Alert queue', 'scheduled for build order step 8');
  }
}
