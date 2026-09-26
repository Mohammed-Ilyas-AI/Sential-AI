import { TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { STREAM_BUFFER_WINDOW_MS, type StreamMessage } from '@sentinel/domain';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideTestStore } from '../../../../testing/provide-test-store';
import { demoAlert, demoFinalDecision, demoHold, demoThirdDecision } from '../../../../testing/ui-fixtures';
import { alertsFeature } from '../../../state/alerts/alerts.feature';
import { interventionsFeature } from '../../../state/interventions/interventions.feature';
import { transactionsFeature } from '../../../state/transactions/transactions.feature';
import { RealtimeConnection } from '../websocket-client/realtime-connection';
import { StreamIngest } from './stream-ingest';

const envelope = <TMessage extends StreamMessage>(kind: TMessage['kind'], payload: TMessage['payload']): StreamMessage =>
  ({ kind, cursor: `cursor-${kind}`, emittedAt: '2026-09-24T01:00:46.000Z', payload }) as StreamMessage;

describe('StreamIngest', () => {
  const messages = new Subject<StreamMessage>();

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideTestStore(), { provide: RealtimeConnection, useValue: { messages$: messages.asObservable() } }],
    });
    TestBed.inject(StreamIngest).start();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads the snapshot at once, then feeds decisions in one batch per buffer window', () => {
    const store = TestBed.inject(Store);
    const tape = store.selectSignal(transactionsFeature.selectTape);

    messages.next(envelope('SNAPSHOT', { decisions: [demoThirdDecision()], alerts: [demoAlert()], interventions: [] }));
    expect(tape().map((row) => row.transactionId)).toEqual(['txn_demo_third']);
    expect(store.selectSignal(alertsFeature.selectOpenAlerts)()).toHaveLength(1);

    messages.next(envelope('DECISION', demoFinalDecision()));
    expect(tape()).toHaveLength(1);
    vi.advanceTimersByTime(STREAM_BUFFER_WINDOW_MS);
    expect(tape().map((row) => row.transactionId)).toEqual(['txn_demo_final', 'txn_demo_third']);
  });

  it('applies alerts and interventions as they arrive', () => {
    const store = TestBed.inject(Store);
    messages.next(envelope('ALERT', demoAlert()));
    messages.next(envelope('INTERVENTION', demoHold()));
    messages.next(envelope('HEARTBEAT', null));
    expect(store.selectSignal(alertsFeature.selectQueue)()[0]?.score).toBe(95);
    expect(store.selectSignal(interventionsFeature.selectActiveHolds)()).toHaveLength(1);
  });
});
