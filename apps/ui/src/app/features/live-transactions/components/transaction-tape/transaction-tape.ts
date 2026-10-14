import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TRANSACTION_TAPE_MAX_ROWS } from '@sentinel/domain';
import { InstitutionLabelPipe } from '../../../../shared/pipes/institution-label/institution-label-pipe';
import { MinorUnitsCurrencyPipe } from '../../../../shared/pipes/minor-units-currency/minor-units-currency-pipe';
import { TransactionStreamFacade } from '../../data-access/transaction-stream-facade';

/** Fixed row height is what makes windowing exact: the spacers stand in for every row not in the DOM. */
const ROW_HEIGHT_PX = 34;
const OVERSCAN_ROWS = 8;
/** jsdom and the first frame have no layout; assume a tall viewport rather than render nothing. */
const FALLBACK_VIEWPORT_PX = 640;

/**
 * The live tape (T§6): a hard cap of 200 rows held, newest first, and virtualised — only the rows in view plus
 * an overscan are in the DOM, so a full tape costs the same to render as a short one. A held row is marked in
 * text as well as colour.
 */
@Component({
  selector: 'sentinel-transaction-tape',
  imports: [DatePipe, MinorUnitsCurrencyPipe, InstitutionLabelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card" aria-labelledby="tape-title">
      <header>
        <h2 id="tape-title">Live transactions</h2>
        <span class="aside sentinel-figures">{{ facade.tapeRows().length }} / {{ maxRows }}</span>
      </header>
      @if (facade.tapeRows().length === 0) {
        <p class="empty">Waiting for the first scored transaction…</p>
      } @else {
        <div class="viewport sentinel-scroll" (scroll)="onScroll($event)">
        <table>
          <thead>
            <tr>
              <th scope="col">Time (UTC)</th>
              <th scope="col">Account</th>
              <th scope="col">To</th>
              <th scope="col" class="numeric">Amount</th>
              <th scope="col" class="numeric">Score</th>
              <th scope="col">Decision</th>
            </tr>
          </thead>
          <tbody>
            @if (window().before > 0) {
              <tr class="spacer" aria-hidden="true" [style.height.px]="window().before"></tr>
            }
            @for (row of window().rows; track row.transactionId) {
              <tr
                [class.held]="row.decision === 'HOLD'"
                [class.focused]="row.accountId === facade.focusedAccountId()"
                [attr.data-band]="row.band"
              >
                <td class="mono muted">{{ row.occurredAt | date: 'HH:mm:ss' : 'UTC' }}</td>
                <td>
                  <button type="button" class="account" (click)="facade.focus(row.accountId)">
                    {{ row.accountReference ?? row.accountId }}
                  </button>
                </td>
                <td class="muted">{{ row.destinationInstitutionId | institutionLabel }}</td>
                <td class="mono numeric">{{ row.amount | minorUnitsCurrency }}</td>
                <td class="numeric">
                  <span class="score mono" [attr.aria-label]="'Score ' + row.score + ', ' + row.band">{{ row.score }}</span>
                </td>
                <td>
                  <span class="decision" [attr.data-decision]="row.decision">{{ row.decision }}</span>
                </td>
              </tr>
            }
            @if (window().after > 0) {
              <tr class="spacer" aria-hidden="true" [style.height.px]="window().after"></tr>
            }
          </tbody>
        </table>
        </div>
      }
    </section>
  `,
  styles: `
    .card {
      background: var(--sentinel-color-surface);
      border: 1px solid var(--sentinel-color-border);
      border-radius: var(--sentinel-radius-medium);
      padding: var(--sentinel-space-4);
      box-shadow: var(--sentinel-elevation-panel);
    }
    .viewport {
      max-height: 68vh;
      overflow: auto;
    }
    header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: var(--sentinel-space-3);
    }
    h2 {
      margin: 0;
      font-size: var(--sentinel-font-size-body);
    }
    .aside,
    .empty,
    .muted {
      color: var(--sentinel-color-text-muted);
      font-size: var(--sentinel-font-size-caption);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--sentinel-font-size-caption);
      font-variant-numeric: tabular-nums;
    }
    th {
      text-align: left;
      font-weight: 500;
      color: var(--sentinel-color-text-muted);
      border-bottom: 1px solid var(--sentinel-color-border);
      padding: var(--sentinel-space-1) var(--sentinel-space-2);
      position: sticky;
      top: 0;
      background: var(--sentinel-color-surface);
    }
    tbody tr {
      height: 34px;
    }
    tr.spacer {
      padding: 0;
      border: 0;
    }
    td {
      white-space: nowrap;
      padding: var(--sentinel-space-1) var(--sentinel-space-2);
      border-bottom: 1px solid color-mix(in srgb, var(--sentinel-color-border) 50%, transparent);
    }
    .numeric {
      text-align: right;
    }
    .mono {
      font-family: var(--sentinel-font-family-mono);
    }
    tr.held {
      background: color-mix(in srgb, var(--sentinel-color-hold) 10%, transparent);
      box-shadow: inset 2px 0 0 var(--sentinel-color-hold);
    }
    tr.focused .account {
      text-decoration: underline;
    }
    .account {
      font: inherit;
      font-family: var(--sentinel-font-family-mono);
      color: var(--sentinel-color-text);
      background: none;
      border: 0;
      padding: 0;
      cursor: pointer;
    }
    tr[data-band='LOW'] .score { color: var(--sentinel-color-risk-low); }
    tr[data-band='ELEVATED'] .score { color: var(--sentinel-color-risk-elevated); }
    tr[data-band='HIGH'] .score { color: var(--sentinel-color-risk-high); }
    tr[data-band='CRITICAL'] .score { color: var(--sentinel-color-risk-critical); font-weight: 600; }
    .decision {
      font-weight: 600;
      font-size: var(--sentinel-font-size-caption);
    }
    .decision[data-decision='ALLOW'] { color: var(--sentinel-color-text-muted); }
    .decision[data-decision='HOLD'],
    .decision[data-decision='REJECT'] { color: var(--sentinel-color-hold); }
  `,
})
export class TransactionTape {
  protected readonly facade = inject(TransactionStreamFacade);
  protected readonly maxRows = TRANSACTION_TAPE_MAX_ROWS;
  private readonly scrollTop = signal(0);
  private readonly viewportHeight = signal(FALLBACK_VIEWPORT_PX);

  protected readonly window = computed(() => {
    const rows = this.facade.tapeRows();
    const first = Math.max(0, Math.floor(this.scrollTop() / ROW_HEIGHT_PX) - OVERSCAN_ROWS);
    const last = Math.min(rows.length, first + Math.ceil(this.viewportHeight() / ROW_HEIGHT_PX) + 2 * OVERSCAN_ROWS);
    return {
      rows: rows.slice(first, last),
      before: first * ROW_HEIGHT_PX,
      after: (rows.length - last) * ROW_HEIGHT_PX,
    };
  });

  protected onScroll(event: Event): void {
    const viewport = event.target as HTMLElement;
    this.scrollTop.set(viewport.scrollTop);
    if (viewport.clientHeight > 0) this.viewportHeight.set(viewport.clientHeight);
  }
}
