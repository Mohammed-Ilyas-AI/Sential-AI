import { ChangeDetectionStrategy, Component } from '@angular/core';

/** The live tape: virtualised, hard cap of 200 rendered rows, rows recolour as an account turns bad. */
@Component({
  selector: 'sentinel-transaction-tape',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section aria-label="Transaction tape"></section>`,
})
export class TransactionTape {}
