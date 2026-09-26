import { Router } from 'express';
import type { HttpRouteRegistration } from '../../../../api/http-route-registration.js';
import type { ApplyTransactionLifecycleEvent } from '../../../../modules/transactions/application/apply-transaction-lifecycle-event.use-case.js';
import { decodePushEnvelope } from '../push-envelope/pubsub-push-envelope.js';
import { transactionEventValidator } from './transaction-event.validator.js';

/**
 * The Pub/Sub push subscription endpoint for lifecycle events after the initial decision. It projects;
 * it never scores. Pub/Sub types stop here and never reach the application layer.
 */
export function transactionEventPushRoutes(lifecycle: ApplyTransactionLifecycleEvent): HttpRouteRegistration {
  const router = Router();
  router.post('/transaction-events', async (request, response) => {
    const envelope = decodePushEnvelope(request.body);
    if (!envelope.valid) {
      response.status(400).json({ error: 'invalid_push_envelope', detail: envelope.problem });
      return;
    }
    const event = transactionEventValidator(envelope.message.data);
    if (!event.valid) {
      response.status(400).json({ error: 'invalid_transaction_event', problems: event.problems });
      return;
    }
    await lifecycle.apply(event.value);
    response.status(204).end();
  });
  return { basePath: '/internal/pubsub', router };
}
