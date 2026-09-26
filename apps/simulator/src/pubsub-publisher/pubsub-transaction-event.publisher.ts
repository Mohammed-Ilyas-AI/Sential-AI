import { NotYetImplementedError } from '@sentinel/domain';
import type { TransactionEventPublisher } from './transaction-event.publisher.js';

/** The only file in the simulator that will hold the Pub/Sub SDK; message ordering enabled per account token. */
export class PubSubTransactionEventPublisher implements TransactionEventPublisher {
  constructor(private readonly topic: string) {}

  publish(): Promise<void> {
    throw new NotYetImplementedError('Pub/Sub publisher', 'scheduled for build order step 2');
  }
}
