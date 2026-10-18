import type { CustomerContactRecord, Intervention } from '@sentinel/domain';

/**
 * On entering HELD the customer is notified with the reason and the available actions. An analyst's contact
 * attempt goes through the same channel. In the prototype the channel is a mock: nobody real is contacted.
 */
export interface CustomerNotificationPublisher {
  notifyHold(intervention: Intervention): Promise<void>;
  notifyContactAttempt(contact: CustomerContactRecord): Promise<void>;
}
