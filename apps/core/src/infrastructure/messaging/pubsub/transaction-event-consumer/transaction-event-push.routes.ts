import { Router } from 'express';
import type { HttpRouteRegistration } from '../../../../api/http-route-registration.js';
import type { ApplyTransactionLifecycleEvent } from '../../../../modules/transactions/application/apply-transaction-lifecycle-event.use-case.js';
import { transactionEventValidator } from '../../../../modules/transactions/presentation/transaction-event.validator.js';
import type { PushAuthenticator } from '../push-authentication/push-authenticator.js';
import { decodePushEnvelope } from '../push-envelope/pubsub-push-envelope.js';

/**
 * The Pub/Sub push subscription endpoint for lifecycle events after the initial decision. It projects; it never
 * scores. Pub/Sub shapes stop here and never reach the application layer.
 */
export function transactionEventPushRoutes(
  lifecycle: ApplyTransactionLifecycleEvent,
  authenticator: PushAuthenticator,
): HttpRouteRegistration {
  const router = Router();
  router.post('/transaction-events', async (request, response) => {
    if (!(await authenticator.authenticate(request.header('authorization')))) {
      response.status(401).json({ error: 'unauthorised' });
      return;
    }
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
    const outcome = await lifecycle.apply(event.value);
    response.status(200).json({ outcome });
  });
  return { basePath: '/internal/pubsub', router };
}
