import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { STREAM_BUFFER_WINDOW_MS, type DecisionRecord, type StreamMessage } from '@sentinel/domain';
import { bufferTime, filter, map } from 'rxjs';
import { AlertsActions } from '../../../state/alerts/alerts.actions';
import { InterventionsActions } from '../../../state/interventions/interventions.actions';
import { TransactionsActions } from '../../../state/transactions/transactions.actions';
import { TransactionWorkerClient } from '../../../workers/transaction-worker.client';
import { PerformanceMetrics } from '../../telemetry/performance-metrics';
import { StreamTelemetry } from '../stream-telemetry/stream-telemetry';
import { RealtimeConnection } from '../websocket-client/realtime-connection';

/**
 * Routes the stream into state: snapshots replace, alerts and interventions append, and decisions are buffered
 * for 250 ms and processed by the worker, so the store sees one action per batch rather than per transaction.
 */
@Injectable({ providedIn: 'root' })
export class StreamIngest {
  private readonly connection = inject(RealtimeConnection);
  private readonly store = inject(Store);
  private readonly worker = inject(TransactionWorkerClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly telemetry = inject(StreamTelemetry);
  private readonly performance = inject(PerformanceMetrics);
  /** Arrival time of the oldest decision not yet in the store, for message-to-row latency. */
  private oldestPendingArrival: number | null = null;

  start(): void {
    const messages$ = this.connection.messages$.pipe(takeUntilDestroyed(this.destroyRef));

    messages$.subscribe((message) => {
      this.telemetry.record(message.emittedAt);
      this.routeImmediate(message);
    });

    messages$
      .pipe(
        filter((message): message is Extract<StreamMessage, { kind: 'DECISION' }> => message.kind === 'DECISION'),
        map((message): DecisionRecord => {
          this.oldestPendingArrival ??= performance.now();
          return message.payload;
        }),
        bufferTime(STREAM_BUFFER_WINDOW_MS),
        filter((batch) => batch.length > 0),
      )
      .subscribe((batch) => {
        this.performance.recordDecisions(batch.length);
        this.worker.process(batch);
      });

    this.worker.processed$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ rows, accounts }) => {
        const started = performance.now();
        this.store.dispatch(TransactionsActions.batchProcessed({ rows, accounts }));
        this.performance.recordBatch(performance.now() - started);
        if (this.oldestPendingArrival !== null) {
          this.performance.recordMessageToRow(this.oldestPendingArrival);
          this.oldestPendingArrival = null;
        }
      });
  }

  private routeImmediate(message: StreamMessage): void {
    switch (message.kind) {
      case 'SNAPSHOT':
        this.store.dispatch(TransactionsActions.snapshotLoaded({ decisions: message.payload.decisions, cursor: message.cursor }));
        this.store.dispatch(AlertsActions.snapshotLoaded({ alerts: message.payload.alerts }));
        this.store.dispatch(InterventionsActions.snapshotLoaded({ interventions: message.payload.interventions }));
        break;
      case 'ALERT':
        this.store.dispatch(AlertsActions.alertUpserted({ alert: message.payload }));
        break;
      case 'INTERVENTION':
        this.store.dispatch(InterventionsActions.interventionAppended({ intervention: message.payload }));
        break;
      case 'DECISION':
      case 'HEARTBEAT':
        break;
    }
  }
}
