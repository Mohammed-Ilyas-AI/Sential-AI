import { NotYetImplementedError } from '@sentinel/domain';
import type { CustomerNotificationPublisher } from '../../modules/interventions/application/ports/customer-notification.port.js';

/** The prototype renders the customer notification as a mock mobile-banking push in the UI. */
export class MockPushCustomerNotificationPublisher implements CustomerNotificationPublisher {
  notifyHold(): Promise<void> {
    throw new NotYetImplementedError('Customer notification', 'scheduled for build order step 7');
  }
}
