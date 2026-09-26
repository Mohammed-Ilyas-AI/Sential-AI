import type { Signal } from '@angular/core';
import type { TapeRow } from '../../../workers/transaction-worker-protocol';

/** WebSocket, 250 ms bufferTime, worker round-trip, one NgRx action per batch; the tape reads only this. */
export abstract class TransactionStreamFacade {
  abstract readonly tapeRows: Signal<readonly TapeRow[]>;
}
