/// <reference lib="webworker" />
import { processTransactionBatch } from './transaction-batch.processor';
import type { TransactionWorkerInput } from './transaction-worker-protocol';

/** Per-batch normalisation and diffing off the main thread (T§5). Only what changed goes back. */
addEventListener('message', (event: MessageEvent<TransactionWorkerInput>) => {
  if (event.data.kind === 'BATCH') postMessage(processTransactionBatch(event.data.batch));
});
