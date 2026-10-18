import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import type { KillSwitchRecord } from '@sentinel/domain';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideTestStore } from '../../../../testing/provide-test-store';
import { CoreApiClient } from '../../../core/http/api-client/core-api-client';
import { AccountControlsFacade } from './account-controls-facade';

const activated: KillSwitchRecord = {
  id: 'ks-1',
  accountId: 'acct_1',
  previousState: 'NONE',
  state: 'ACTIVE',
  reason: 'Phone stolen',
  actor: 'ANALYST',
  actorIdentity: 'demo-analyst',
  actedAt: '2026-09-24T12:00:00.000Z',
  idempotencyKey: 'k',
};

describe('AccountControlsFacade', () => {
  const get = vi.fn();
  const post = vi.fn();

  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    get.mockImplementation((path: string) =>
      path.endsWith('/kill-switch') ? of({ accountId: 'acct_1', active: false, history: [] }) : of({ accountId: 'acct_1', contacts: [] }),
    );
    TestBed.configureTestingModule({ providers: [provideTestStore(), { provide: CoreApiClient, useValue: { get, post } }, AccountControlsFacade] });
  });

  it('activates the kill switch with the reason, the confirmed account and a key that survives a retry', () => {
    const facade = TestBed.inject(AccountControlsFacade);
    facade.load('acct_1');
    post.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })));
    facade.activateKillSwitch('Phone stolen');
    expect(facade.failure()).toContain('unreachable');
    post.mockReturnValueOnce(of({ outcome: 'CREATED', record: activated }));
    facade.activateKillSwitch('Phone stolen');
    const [first, second] = post.mock.calls.map((call) => call[1] as { idempotencyKey: string; confirmAccountId: string; reason: string });
    expect(first?.idempotencyKey).toBe(second?.idempotencyKey);
    expect(second).toMatchObject({ confirmAccountId: 'acct_1', reason: 'Phone stolen', analystIdentity: 'demo-analyst' });
    expect(facade.killSwitch()?.active).toBe(true);
  });

  it('records a contact as the server stored it and never claims a real customer was reached', () => {
    const facade = TestBed.inject(AccountControlsFacade);
    facade.load('acct_1');
    post.mockReturnValue(of({ outcome: 'CREATED', record: { id: 'c-1', channel: 'PHONE', outcome: 'NO_ANSWER', simulated: true } }));
    facade.recordContact('PHONE', 'NO_ANSWER', '  ', 'tx-1');
    expect(post).toHaveBeenCalledWith('/v1/accounts/acct_1/customer-contacts', expect.not.objectContaining({ note: expect.anything() }));
    expect(facade.contacts()).toHaveLength(1);
    expect(facade.notice()).toContain('simulated');
  });
});
