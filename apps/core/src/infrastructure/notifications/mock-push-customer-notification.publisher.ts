import type { Intervention } from '@sentinel/domain';
import type { CustomerNotificationPublisher } from '../../modules/interventions/application/ports/customer-notification.port.js';
import type { Logger } from '../telemetry/logger.js';

/**
 * The prototype has no real customer channel: the UI renders the mock mobile-banking push from the HELD
 * intervention it receives over the stream, and this publisher records that the notification was emitted.
 */
export class MockPushCustomerNotificationPublisher implements CustomerNotificationPublisher {
  constructor(private readonly logger: Logger) {}

  async notifyHold(intervention: Intervention): Promise<void> {
    this.logger.info(
      {
        event: 'customer_notification_emitted',
        transactionId: intervention.transactionId,
        accountId: intervention.accountId,
        holdUntil: intervention.holdUntil,
        reasonCodes: intervention.reasonCodes,
        availableActions: ['CUSTOMER_VERIFIED_RELEASE', 'CUSTOMER_CANCELLATION'],
      },
      'customer notified of hold',
    );
  }
}
