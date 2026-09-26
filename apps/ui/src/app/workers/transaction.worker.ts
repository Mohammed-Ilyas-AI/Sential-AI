/// <reference lib="webworker" />
import type { TransactionWorkerInput } from './transaction-worker-protocol';

/**
 * Normalisation, rolling velocity, optimistic 24h outflow and drain %, payee/device counters and diffing,
 * off the main thread (T§5), using @sentinel/rules for the same arithmetic as the server. Build order step 8.
 */
addEventListener('message', (event: MessageEvent<TransactionWorkerInput>) => {
  void event;
});
