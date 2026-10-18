import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Store } from '@ngrx/store';
import { TRANSACTION_TAPE_MAX_ROWS } from '@sentinel/domain';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideTestStore } from '../../../../../testing/provide-test-store';
import { decisionRecord, demoFinalDecision, demoHold } from '../../../../../testing/ui-fixtures';
import { InterventionsActions } from '../../../../state/interventions/interventions.actions';
import { TransactionsActions } from '../../../../state/transactions/transactions.actions';
import { TransactionTape } from './transaction-tape';

describe('TransactionTape', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TransactionTape], providers: [provideTestStore(), provideRouter([])] }).compileComponents();
    const decisions = [
      ...Array.from({ length: 259 }, (_, index) =>
        decisionRecord({
          transactionId: `txn_${String(index).padStart(3, '0')}`,
          occurredAt: new Date(Date.parse('2026-09-24T00:00:00.000Z') + index * 1_000).toISOString(),
        }),
      ),
      demoFinalDecision(),
    ];
    const store = TestBed.inject(Store);
    store.dispatch(TransactionsActions.snapshotLoaded({ decisions, cursor: 'cursor-1' }));
    store.dispatch(InterventionsActions.snapshotLoaded({ interventions: [demoHold()] }));
  });

  async function render() {
    const fixture = TestBed.createComponent(TransactionTape);
    await fixture.whenStable();
    return { fixture, host: fixture.nativeElement as HTMLElement, settle: () => fixture.whenStable() };
  }

  const rows = (host: HTMLElement) => [...host.querySelectorAll('tbody tr')];
  const choose = (select: HTMLSelectElement, value: string) => {
    select.value = value;
    select.dispatchEvent(new Event('change'));
  };

  it('holds at most 200 rows and renders only one page of them', async () => {
    const { host } = await render();
    expect(host.querySelector('.aside')?.textContent).toContain(`${TRANSACTION_TAPE_MAX_ROWS} / ${TRANSACTION_TAPE_MAX_ROWS}`);
    expect(rows(host)).toHaveLength(25);
    expect(host.querySelector('.range')?.textContent).toContain('Showing 1–25 of 200');
    expect((host.querySelector('.size select') as HTMLSelectElement).value).toBe('25');
  });

  it('pages through the tape and changes the page size', async () => {
    const { host, settle } = await render();
    (host.querySelector('.page-button[aria-current="page"] + .page-button') as HTMLButtonElement).click();
    await settle();
    expect(host.querySelector('.range')?.textContent).toContain('Showing 26–50 of 200');

    choose(host.querySelector('.size select') as HTMLSelectElement, '50');
    await settle();
    expect(rows(host)).toHaveLength(50);
    expect(host.querySelector('.range')?.textContent).toContain('Showing 1–50 of 200');
  });

  it('filters by decision and shows the held transfer with the intervention state the server recorded', async () => {
    const { host, settle } = await render();
    const [, decision] = [...host.querySelectorAll<HTMLSelectElement>('.toolbar select')];
    choose(decision as HTMLSelectElement, 'HOLD');
    await settle();
    const held = rows(host);
    expect(held).toHaveLength(1);
    expect(held[0]?.querySelector('.decision')?.textContent?.trim()).toBe('HOLD');
    expect(held[0]?.querySelector('.status')?.textContent?.trim()).toBe('Held');
    expect(held[0]?.querySelector('.score')?.textContent?.trim()).toBe('95');
    expect(host.querySelector('.aside')?.textContent).toContain('1 / 200');
  });

  it('searches by account reference and says so when nothing matches', async () => {
    const { host, settle } = await render();
    const search = host.querySelector('input[type="search"]') as HTMLInputElement;
    search.value = 'ACC-10291';
    search.dispatchEvent(new Event('input'));
    await settle();
    expect(rows(host)).toHaveLength(1);

    search.value = 'no-such-account';
    search.dispatchEvent(new Event('input'));
    await settle();
    expect(host.querySelector('.empty')?.textContent).toContain('No transaction matches these filters');
  });

  it('selects a transaction for the detail panel when its row is clicked', async () => {
    const { fixture, host, settle } = await render();
    (rows(host)[0] as HTMLElement).click();
    await settle();
    expect(fixture.componentInstance.selected()).toBe('txn_demo_final');
    expect(rows(host)[0]?.getAttribute('aria-selected')).toBe('true');
  });
});
