import type { TransactionEvent } from '@sentinel/domain';
import { PubSub } from '@google-cloud/pubsub';
import { toPubSubMessage, type TransactionEventPublisher } from './transaction-event.publisher.js';

/** The slice of the Pub/Sub Topic this publisher uses; the SDK's Topic satisfies it. */
export interface OrderedTopic {
  publishMessage(message: ReturnType<typeof toPubSubMessage>): Promise<string>;
  resumePublishing(orderingKey: string): void;
}

/**
 * The only file in the simulator holding the Pub/Sub SDK. Message ordering is enabled per account token, which
 * the drain arithmetic depends on. After a failed publish the key is resumed so later events are not blocked.
 */
export class PubSubTransactionEventPublisher implements TransactionEventPublisher {
  constructor(
    private readonly topic: OrderedTopic,
    private readonly closeClient: () => Promise<void> = async () => undefined,
  ) {}

  static forTopic(projectId: string, topicName: string): PubSubTransactionEventPublisher {
    const client = new PubSub({ projectId });
    return new PubSubTransactionEventPublisher(client.topic(topicName, { messageOrdering: true }), () => client.close());
  }

  async publish(event: TransactionEvent): Promise<void> {
    const message = toPubSubMessage(event);
    try {
      await this.topic.publishMessage(message);
    } catch (error) {
      this.topic.resumePublishing(message.orderingKey);
      throw error;
    }
  }

  close(): Promise<void> {
    return this.closeClient();
  }
}
