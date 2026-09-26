import { Injectable, type OnDestroy } from '@angular/core';
import type { DecisionRecord } from '@sentinel/domain';
import { Subject, type Observable } from 'rxjs';
import { processTransactionBatch } from './transaction-batch.processor';
import type { TransactionWorkerInput, TransactionWorkerOutput } from './transaction-worker-protocol';

/** Round-trips batches through the transaction worker, or processes them in-thread where workers are unavailable. */
@Injectable({ providedIn: 'root' })
export class TransactionWorkerClient implements OnDestroy {
  private readonly outputs = new Subject<TransactionWorkerOutput>();
  private readonly worker: Worker | null =
    typeof Worker === 'undefined' ? null : new Worker(new URL('./transaction.worker', import.meta.url), { type: 'module' });

  constructor() {
    if (this.worker) this.worker.onmessage = (event: MessageEvent<TransactionWorkerOutput>) => this.outputs.next(event.data);
  }

  readonly processed$: Observable<TransactionWorkerOutput> = this.outputs.asObservable();

  process(batch: readonly DecisionRecord[]): void {
    const input: TransactionWorkerInput = { kind: 'BATCH', batch };
    if (this.worker) this.worker.postMessage(input);
    else this.outputs.next(processTransactionBatch(batch));
  }

  ngOnDestroy(): void {
    this.worker?.terminate();
  }
}
