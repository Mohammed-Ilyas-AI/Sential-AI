import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import type { Intervention } from '@sentinel/domain';
import { of, throwError, type Observable } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideTestStore } from '../../../../../testing/provide-test-store';
import { decisionRecord, demoAlert, demoFinalDecision, demoHold } from '../../../../../testing/ui-fixtures';
import { AlertsActions } from '../../../../state/alerts/alerts.actions';
import { InterventionsActions } from '../../../../state/interventions/interventions.actions';
import { interventionsFeature } from '../../../../state/interventions/interventions.feature';
import { TransactionsActions } from '../../../../state/transactions/transactions.actions';
import { InterventionsApi } from '../../data-access/interventions-api';
import { HoldActions } from './hold-actions';

const trigger = demoFinalDecision();
const cascadedDecision = decisionRecord({
  transactionId: 'txn_demo_cascade',
  accountId: trigger.accountId,
  decision: 'HOLD',
  amount: 50_000,
  cascadeOfTransactionId: trigger.transactionId,
  occurredAt: '2026-09-24T01:02:00.000Z',
  decidedAt: '2026-09-24T01:02:00.000Z',
});
const cascadedHold = demoHold({
  id: 'int_demo_cascade',
  transactionId: cascadedDecision.transactionId,
  decisionId: cascadedDecision.decisionId,
  reasonCodes: ['SG-RD-50_HOLD_CASCADE'],
  cascadeOfTransactionId: trigger.transactionId,
  actedAt: '2026-09-24T01:02:00.000Z',
});

const recorded = (state: Intervention['state'], actor: Intervention['actor'], transactionId: string): Intervention =>
  demoHold({ id: `int_${state}`, transactionId, previousState: 'HELD', state, actor });

describe('HoldActions', () => {
  let api: { [K in keyof InterventionsApi]: ReturnType<typeof vi.fn<(...args: never[]) => Observable<Intervention>>> };

  beforeEach(async () => {
    api = { releaseAfterCustomerVerification: vi.fn(), cancelByCustomer: vi.fn(), confirmFraud: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [HoldActions],
      providers: [provideTestStore(), { provide: InterventionsApi, useValue: api }],
    }).compileComponents();
    const store = TestBed.inject(Store);
    store.dispatch(TransactionsActions.snapshotLoaded({ decisions: [trigger, cascadedDecision], cursor: 'cursor-1' }));
    store.dispatch(AlertsActions.snapshotLoaded({ alerts: [demoAlert()] }));
    store.dispatch(AlertsActions.accountSelected({ accountId: trigger.accountId }));
    store.dispatch(InterventionsActions.snapshotLoaded({ interventions: [demoHold(), cascadedHold] }));
  });

  async function render() {
    const fixture = TestBed.createComponent(HoldActions);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const click = async (element: Element | null | undefined) => {
      (element as HTMLButtonElement).click();
      await fixture.whenStable();
    };
    return { host, click };
  }

  const items = (host: HTMLElement) => [...host.querySelectorAll('li')];

  it('lists the trigger and the cascaded outflow, newest first, with the account in the hold state', async () => {
    const { host } = await render();
    expect(host.querySelector('.state')?.textContent).toContain('Account in hold state');
    expect(items(host).map((item) => item.querySelector('.why')?.textContent?.trim())).toEqual(['Hold cascade', 'Threshold breach']);
    expect(items(host)[0]?.textContent).toContain(`after ${trigger.transactionId}`);
    expect(host.textContent).toContain('GIRO/eGIRO and designated bill payments continue');
  });

  it('records nothing until the analyst confirms, then releases on customer verification', async () => {
    const { host, click } = await render();
    api.releaseAfterCustomerVerification.mockReturnValue(of(recorded('RELEASED', 'CUSTOMER', trigger.transactionId)));
    const triggerItem = items(host)[1];
    await click(triggerItem?.querySelector('[data-action="customer-verified-release"]'));
    expect(api.releaseAfterCustomerVerification).not.toHaveBeenCalled();
    expect(triggerItem?.querySelector('.confirm')?.textContent).toContain('customer verified with the bank');

    await click(triggerItem?.querySelector('.confirm .primary'));
    expect(api.releaseAfterCustomerVerification).toHaveBeenCalledWith(trigger.transactionId);
    const history = TestBed.inject(Store).selectSignal(interventionsFeature.selectByTransactionId)()[trigger.transactionId];
    expect(history?.map((record) => record.state)).toEqual(['HELD', 'RELEASED']);
    expect(items(host).map((item) => item.querySelector('.why')?.textContent?.trim())).toEqual(['Hold cascade']);
  });

  it('cancels at the customer’s request and steps back without recording', async () => {
    const { host, click } = await render();
    api.cancelByCustomer.mockReturnValue(of(recorded('CANCELLED', 'CUSTOMER', cascadedHold.transactionId)));
    await click(items(host)[0]?.querySelector('[data-action="customer-cancellation"]'));
    await click([...(items(host)[0]?.querySelectorAll('.confirm button') ?? [])].at(-1));
    expect(items(host)[0]?.querySelector('.confirm')).toBeNull();
    await click(items(host)[0]?.querySelector('[data-action="customer-cancellation"]'));
    await click(items(host)[0]?.querySelector('.confirm .primary'));
    expect(api.cancelByCustomer).toHaveBeenCalledTimes(1);
    expect(api.cancelByCustomer).toHaveBeenCalledWith(cascadedHold.transactionId);
  });

  it('confirms fraud only under the analyst identity, and says so when sentinel-core refuses', async () => {
    const { host, click } = await render();
    api.confirmFraud.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    await click(items(host)[0]?.querySelector('[data-action="fraud-confirmation"]'));
    expect(items(host)[0]?.querySelector('.confirm')?.textContent).toContain('demo-analyst');
    await click(items(host)[0]?.querySelector('.confirm .primary'));
    expect(api.confirmFraud).toHaveBeenCalledWith(cascadedHold.transactionId, 'demo-analyst');
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('already moved');
    expect(items(host)).toHaveLength(2);
  });
});
