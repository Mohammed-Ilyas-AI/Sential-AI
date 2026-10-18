import type { CustomerContactRecord, Intervention } from '@sentinel/domain';
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

  /** Records that a contact attempt was emitted on the mock channel. Identifiers only: never the analyst's note. */
  async notifyContactAttempt(contact: CustomerContactRecord): Promise<void> {
    this.logger.info(
      {
        event: 'customer_contact_attempt_emitted',
        contactId: contact.id,
        accountId: contact.accountId,
        channel: contact.channel,
        outcome: contact.outcome,
        simulated: true,
      },
      'customer contact attempt recorded on the mock channel',
    );
  }
}
