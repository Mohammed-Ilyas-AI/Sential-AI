import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import type { CustomerOutreachProposal, LiveDemoHold, LiveDemoReport } from '@sentinel/domain';
import { firstValueFrom } from 'rxjs';
import { CoreApiClient } from '../../../core/http/api-client/core-api-client';
import { AlertsActions } from '../../../state/alerts/alerts.actions';
import { sessionFeature } from '../../../state/session/session.feature';

export type LiveDemoStep = 'STREAM' | 'HOLD' | 'INVESTIGATE' | 'CALL' | 'EMAIL' | 'KILL_SWITCH' | 'DONE';
/** What the walkthrough asks the Investigations action centre to do, on screen, as the demo analyst. */
export type LiveDemoCommandKind = 'CALL' | 'EMAIL' | 'KILL_SWITCH';

export interface LiveDemoCommand {
  readonly id: number;
  readonly kind: LiveDemoCommandKind;
  readonly accountId: string;
}

export const LIVE_DEMO_STEPS: readonly { readonly step: LiveDemoStep; readonly label: string }[] = [
  { step: 'STREAM', label: 'Transactions stream in and are scored' },
  { step: 'HOLD', label: 'The rapid-drain gate holds a transfer' },
  { step: 'INVESTIGATE', label: 'The account opens in Investigations' },
  { step: 'CALL', label: 'Automated call to the customer' },
  { step: 'KILL_SWITCH', label: 'No answer: kill switch' },
  { step: 'EMAIL', label: 'Email to the customer' },
  { step: 'DONE', label: 'Account protected' },
];

/**
 * At demo time a hold auto-releases 24 s after it is placed, so the walkthrough reaches the kill switch inside
 * that window: short pauses, and the customer message is requested the moment the hold is known.
 */
const PAUSE_MS = { HOLD: 4_500, INVESTIGATE: 3_000, BETWEEN: 1_500 } as const;
const COMMAND_TIMEOUT_MS = 120_000;

const sgd = (minorUnits: number): string => `S$${(minorUnits / 100).toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * The one-click live demo (M§6). sentinel-core plays the synthetic DEMO_TAKEOVER_01 through its real control path;
 * the walkthrough then moves through the pages and works the case in the Investigations action centre, visibly,
 * as the demo analyst: an automated call, a Gemini-drafted email, then the kill switch when nobody answers.
 * The rules decide the hold; every action is the same recorded, audited API call an analyst's click makes.
 */
@Injectable({ providedIn: 'root' })
export class LiveDemoAutopilot {
  private readonly api = inject(CoreApiClient);
  private readonly router = inject(Router);
  private readonly store = inject(Store);
  private readonly analyst = this.store.selectSignal(sessionFeature.selectAnalystIdentity);

  readonly status = signal<'IDLE' | 'RUNNING' | 'DONE' | 'FAILED'>('IDLE');
  readonly step = signal<LiveDemoStep | null>(null);
  readonly narration = signal('');
  readonly failure = signal<string | null>(null);
  readonly hold = signal<LiveDemoHold | null>(null);
  readonly report = signal<LiveDemoReport | null>(null);
  readonly startedAt = signal<number | null>(null);
  readonly running = computed(() => this.status() === 'RUNNING');
  readonly visible = computed(() => this.status() !== 'IDLE');

  private readonly commandState = signal<LiveDemoCommand | null>(null);
  /** The action the centre should perform now, or null. */
  readonly command = this.commandState.asReadonly();
  private readonly drafts = new Map<string, Promise<CustomerOutreachProposal | null>>();
  private commandSequence = 0;
  private pending: { readonly id: number; readonly resolve: (ok: boolean) => void } | null = null;
  private stopped = false;

  async start(): Promise<void> {
    if (this.running()) return;
    this.stopped = false;
    this.status.set('RUNNING');
    this.failure.set(null);
    this.hold.set(null);
    this.report.set(null);
    this.startedAt.set(Date.now());
    try {
      this.at('STREAM', 'sentinel-core is playing a synthetic account takeover through the real decision path. Each transfer is scored by the rules engine as it arrives (about 45 seconds).');
      await this.router.navigateByUrl('/live-transactions');
      const report = await firstValueFrom(this.api.post<LiveDemoReport>('/v1/demo/live-demo', { analystIdentity: this.analyst() ?? 'demo-analyst' }));
      this.report.set(report);
      const held = report.held[0];
      if (!held) throw new Error('The scenario finished without a held transfer.');
      this.hold.set(held);
      this.prefetchOutreach(held.assessmentId);
      this.guard();

      this.at('HOLD', `Held: ${sgd(held.amount)} took the account past the 50% rapid-drain line in 24 hours (risk ${held.riskScore}/100). The rules engine decided; the customer was notified.`);
      await this.router.navigate(['/live-transactions'], { queryParams: { txn: held.transactionId } });
      await this.pause(PAUSE_MS.HOLD);

      this.at('INVESTIGATE', 'The analyst opens the account in Investigations: evidence, risk attribution and every action in one place.');
      this.store.dispatch(AlertsActions.accountSelected({ accountId: held.accountId }));
      await this.router.navigateByUrl('/investigations');
      await this.pause(PAUSE_MS.INVESTIGATE);

      this.at('CALL', 'An automated call to the customer, reading a script Gemini wrote from the evidence (or sentinel-core’s fixed wording if Gemini is unavailable).');
      await this.issue('CALL', held.accountId);
      await this.pause(PAUSE_MS.BETWEEN);

      this.at('KILL_SWITCH', 'No answer. The customer cannot be reached, so the analyst activates the kill switch: the held transfer and every further outflow stay held until the customer verifies with the bank.');
      await this.issue('KILL_SWITCH', held.accountId);
      await this.pause(PAUSE_MS.BETWEEN);

      this.at('EMAIL', 'The system also emails the customer the drafted message: no links, never a request for a password or one-time code.');
      await this.issue('EMAIL', held.accountId);
      await this.pause(PAUSE_MS.BETWEEN);

      this.at('DONE', 'Account protected. Rules decided the hold, Gemini drafted the customer message, and the analyst authorised every action. All of it is in the audit log.');
      this.status.set('DONE');
    } catch (error) {
      if (this.stopped) return;
      this.status.set('FAILED');
      this.failure.set(this.describe(error));
    } finally {
      this.commandState.set(null);
      this.pending = null;
    }
  }

  stop(): void {
    this.stopped = true;
    this.pending?.resolve(false);
    this.pending = null;
    this.commandState.set(null);
    this.status.set('IDLE');
    this.step.set(null);
  }

  /** The customer message requested for this assessment when the hold was reported, if there is one. */
  prefetchedOutreach(assessmentId: string): Promise<CustomerOutreachProposal | null> | null {
    return this.drafts.get(assessmentId) ?? null;
  }

  private prefetchOutreach(assessmentId: string): void {
    this.drafts.clear();
    this.drafts.set(
      assessmentId,
      firstValueFrom(this.api.post<CustomerOutreachProposal>(`/v1/investigations/${encodeURIComponent(assessmentId)}/customer-outreach`, {})).catch(() => null),
    );
  }

  /** Called by the action centre when it has finished (or could not finish) the command it was given. */
  complete(id: number, ok: boolean): void {
    if (this.pending?.id !== id) return;
    this.pending.resolve(ok);
    this.pending = null;
    this.commandState.set(null);
  }

  private at(step: LiveDemoStep, narration: string): void {
    this.step.set(step);
    this.narration.set(narration);
  }

  private async issue(kind: LiveDemoCommandKind, accountId: string): Promise<void> {
    this.guard();
    const id = ++this.commandSequence;
    const done = new Promise<boolean>((resolve) => {
      this.pending = { id, resolve };
      setTimeout(() => resolve(false), COMMAND_TIMEOUT_MS);
    });
    this.commandState.set({ id, kind, accountId });
    if (!(await done)) {
      this.guard();
      throw new Error(`The ${kind.replace('_', ' ').toLowerCase()} step did not complete; the action centre shows why.`);
    }
  }

  private async pause(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
    this.guard();
  }

  private guard(): void {
    if (this.stopped) throw new Error('stopped');
  }

  private describe(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) return 'sentinel-core is unreachable, so the live demo could not start.';
      if (error.status === 409) return 'A live demo is already running. Wait about a minute and try again.';
      return `sentinel-core refused the live demo (HTTP ${error.status}).`;
    }
    return error instanceof Error ? error.message : 'The live demo stopped unexpectedly.';
  }
}
