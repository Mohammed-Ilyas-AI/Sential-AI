import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Store } from '@ngrx/store';
import type { CustomerOutreachProposal } from '@sentinel/domain';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideTestStore } from '../../../../../testing/provide-test-store';
import { demoHold } from '../../../../../testing/ui-fixtures';
import { LOCAL_RUNTIME_CONFIG, provideRuntimeConfig } from '../../../../core/config/runtime-config';
import { CoreApiClient } from '../../../../core/http/api-client/core-api-client';
import { InterventionsActions } from '../../../../state/interventions/interventions.actions';
import { LiveDemoAutopilot } from '../../../demo-controls';
import { ActionCentre } from './action-centre';

const proposal: CustomerOutreachProposal = {
  source: 'GEMINI',
  draft: { subject: 'We paused a transfer from your account', emailBody: 'We paused a transfer. Please call the number on your card.', callScript: 'This is your bank calling.' },
  model: { status: 'GENERATED', advisory: { subject: 's', emailBody: 'b', callScript: 'c' }, attempts: 1, droppedClaims: 0 },
};

describe('ActionCentre', () => {
  const hold = demoHold({ holdUntil: new Date(Date.now() + 20_000).toISOString() });
  const get = vi.fn();
  const post = vi.fn();

  beforeEach(async () => {
    get.mockReset();
    post.mockReset();
    get.mockImplementation((path: string) =>
      path.endsWith('/kill-switch') ? of({ accountId: hold.accountId, active: false, history: [] }) : of({ accountId: hold.accountId, contacts: [] }),
    );
    post.mockImplementation((path: string, body: { channel?: string; outcome?: string }) => {
      if (path.endsWith('/customer-outreach')) return of(proposal);
      if (path.endsWith('/customer-contacts')) {
        return of({ outcome: 'CREATED', record: { id: `c-${post.mock.calls.length}`, accountId: hold.accountId, channel: body.channel, outcome: body.outcome, recordedAt: new Date().toISOString(), simulated: true } });
      }
      if (path.endsWith('/kill-switch')) {
        return of({ outcome: 'CREATED', record: { id: 'ks-1', accountId: hold.accountId, previousState: 'NONE', state: 'ACTIVE', reason: 'r', actor: 'ANALYST', actorIdentity: 'demo-analyst', actedAt: new Date().toISOString(), idempotencyKey: 'k' } });
      }
      return of({ ...hold, id: 'int-2', previousState: 'HELD', state: 'RELEASED', actor: 'CUSTOMER', actedAt: new Date().toISOString() });
    });
    await TestBed.configureTestingModule({
      imports: [ActionCentre],
      providers: [provideTestStore(), provideRouter([]), provideRuntimeConfig(LOCAL_RUNTIME_CONFIG), { provide: CoreApiClient, useValue: { get, post } }],
    }).compileComponents();
  });
  afterEach(() => vi.useRealTimers());

  async function render() {
    const fixture = TestBed.createComponent(ActionCentre);
    fixture.componentRef.setInput('accountId', hold.accountId);
    fixture.componentRef.setInput('reference', 'ACC-10291');
    fixture.componentRef.setInput('assessmentId', 'asm-1');
    fixture.componentRef.setInput('transactionId', hold.transactionId);
    await fixture.whenStable();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  }

  const button = (host: HTMLElement, text: string) => [...host.querySelectorAll('button')].find((candidate) => candidate.textContent?.includes(text)) as HTMLButtonElement;

  it('shows the held transfer with its countdown and records an exception only after a second confirmation', async () => {
    TestBed.inject(Store).dispatch(InterventionsActions.interventionAppended({ intervention: hold }));
    const { fixture, host } = await render();
    expect(host.textContent).toMatch(/Auto-release in \d+ s/);
    button(host, 'Release · customer verified').click();
    await fixture.whenStable();
    expect(post).not.toHaveBeenCalled();
    button(host, 'Record').click();
    await fixture.whenStable();
    expect(post).toHaveBeenCalledWith(`/v1/interventions/${hold.transactionId}/customer-verified-release`, {});
  });

  it('emails the customer the Gemini draft and records it as a simulated email', async () => {
    const { fixture, host } = await render();
    button(host, 'Email the customer').click();
    await vi.waitFor(() => expect(post).toHaveBeenCalledWith(`/v1/accounts/${hold.accountId}/customer-contacts`, expect.objectContaining({ channel: 'EMAIL', outcome: 'NOTIFICATION_SENT' })));
    await fixture.whenStable();
    expect(host.textContent).toContain('Drafted by Gemini');
    expect(host.textContent).toContain('We paused a transfer from your account');
  });

  it('works live-demo commands on screen: the unanswered call, the voicemail, then the kill switch', async () => {
    const { fixture, host } = await render();
    const demo = TestBed.inject(LiveDemoAutopilot);
    const complete = vi.spyOn(demo, 'complete');
    (demo as unknown as { commandState: { set(value: unknown): void } }).commandState.set({ id: 7, kind: 'CALL', accountId: hold.accountId });
    await vi.waitFor(() => expect(complete).toHaveBeenCalledWith(7, true), { timeout: 10_000 });
    expect(post).toHaveBeenCalledWith(`/v1/accounts/${hold.accountId}/customer-contacts`, expect.objectContaining({ channel: 'AUTOMATED_CALL', outcome: 'NO_ANSWER' }));

    (demo as unknown as { commandState: { set(value: unknown): void } }).commandState.set({ id: 9, kind: 'VOICEMAIL', accountId: hold.accountId });
    await vi.waitFor(() => expect(complete).toHaveBeenCalledWith(9, true), { timeout: 10_000 });
    expect(post).toHaveBeenCalledWith(
      `/v1/accounts/${hold.accountId}/customer-contacts`,
      expect.objectContaining({ channel: 'AUTOMATED_CALL', outcome: 'MESSAGE_LEFT', note: 'Voicemail left (drafted by Gemini)' }),
    );

    (demo as unknown as { commandState: { set(value: unknown): void } }).commandState.set({ id: 8, kind: 'KILL_SWITCH', accountId: hold.accountId });
    await vi.waitFor(() => expect(complete).toHaveBeenCalledWith(8, true), { timeout: 10_000 });
    await fixture.whenStable();
    expect(host.textContent).toContain('Kill switch active');
  }, 20_000);
});
