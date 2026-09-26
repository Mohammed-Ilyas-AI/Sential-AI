import type { Intervention } from '@sentinel/domain';

/** On entering HELD the customer is notified with the reason and the available actions. */
export interface CustomerNotificationPublisher {
  notifyHold(intervention: Intervention): Promise<void>;
}
