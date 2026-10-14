import { TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { TRANSACTION_TAPE_MAX_ROWS } from '@sentinel/domain';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideTestStore } from '../../../../../testing/provide-test-store';
import { decisionRecord } from '../../../../../testing/ui-fixtures';
import { TransactionsActions } from '../../../../state/transactions/transactions.actions';
import { TransactionTape } from './transaction-tape';

const ROW_HEIGHT_PX = 34;

describe('TransactionTape', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TransactionTape], providers: [provideTestStore()] }).compileComponents();
    const decisions = Array.from({ length: 260 }, (_, index) =>
      decisionRecord({
        transactionId: `txn_${String(index).padStart(3, '0')}`,
        occurredAt: new Date(Date.parse('2026-09-24T00:00:00.000Z') + index * 1_000).toISOString(),
      }),
    );
    TestBed.inject(Store).dispatch(TransactionsActions.snapshotLoaded({ decisions, cursor: 'cursor-1' }));
  });

  async function render() {
    const fixture = TestBed.createComponent(TransactionTape);
    await fixture.whenStable();
    return { host: fixture.nativeElement as HTMLElement, settle: () => fixture.whenStable() };
  }

  const dataRows = (host: HTMLElement) => [...host.querySelectorAll('tbody tr:not(.spacer)')];
  const spacerHeight = (host: HTMLElement, index: number) => (host.querySelectorAll<HTMLElement>('tbody tr.spacer')[index]?.style.height ?? '');

  it('holds at most 200 rows but renders only the window in view', async () => {
    const { host } = await render();
    expect(host.querySelector('.aside')?.textContent).toContain(`${TRANSACTION_TAPE_MAX_ROWS} / ${TRANSACTION_TAPE_MAX_ROWS}`);
    const rendered = dataRows(host).length;
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(50);
    expect(spacerHeight(host, 0)).toBe(`${(TRANSACTION_TAPE_MAX_ROWS - rendered) * ROW_HEIGHT_PX}px`);
  });

  it('moves the window as the viewport scrolls, keeping the full height with spacers', async () => {
    const { host, settle } = await render();
    const viewport = host.querySelector('.viewport') as HTMLElement;
    Object.defineProperty(viewport, 'scrollTop', { configurable: true, value: 100 * ROW_HEIGHT_PX });
    Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 10 * ROW_HEIGHT_PX });
    viewport.dispatchEvent(new Event('scroll'));
    await settle();

    const rows = dataRows(host);
    expect(rows).toHaveLength(10 + 2 * 8);
    const before = Number.parseInt(spacerHeight(host, 0), 10);
    const after = Number.parseInt(spacerHeight(host, 1), 10);
    expect(before).toBe(92 * ROW_HEIGHT_PX);
    expect(before + rows.length * ROW_HEIGHT_PX + after).toBe(TRANSACTION_TAPE_MAX_ROWS * ROW_HEIGHT_PX);
  });
});
