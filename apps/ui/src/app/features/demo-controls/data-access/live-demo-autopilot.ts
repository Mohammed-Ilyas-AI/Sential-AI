import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { DEMO_TAKEOVER_01, type CustomerOutreachProposal, type DecisionResponse, type Intervention, type LiveDemoHold, type LiveDemoReport } from '@sentinel/domain';
import { firstValueFrom } from 'rxjs';
import { CoreApiClient } from '../../../core/http/api-client/core-api-client';
import { AlertsActions } from '../../../state/alerts/alerts.actions';
import { sessionFeature } from '../../../state/session/session.feature';

export type LiveDemoStep = 'STREAM' | 'HOLD' | 'CALL' | 'KILL_SWITCH' | 'OUTREACH' | 'BLOCKED' | 'TRACE' | 'DONE';
/** What the walkthrough asks the Investigations action centre to do, on screen, as the demo analyst. */
export type LiveDemoCommandKind = 'CALL' | 'KILL_SWITCH' | 'VOICEMAIL' | 'EMAIL';

export interface LiveDemoCommand {
  readonly id: number;
  readonly kind: LiveDemoCommandKind;
  readonly accountId: string;
}

/** Who speaks in the agent console: each line is attributed, so the audience sees who decided what. */
export type ConsoleSpeaker = 'BANK' | 'RULES' | 'GEMINI' | 'AGENT' | 'ANALYST' | 'CUSTOMER';

export interface ConsoleLine {
  readonly id: number;
  readonly speaker: ConsoleSpeaker;
  readonly text: string;
}

/** What reaches the synthetic customer's phone. Simulated channels only; nobody real is contacted. */
export interface PhoneEvent {
  readonly id: number;
  readonly kind: 'PUSH' | 'CALL' | 'VOICEMAIL' | 'EMAIL';
  readonly title: string;
  readonly body: string;
  readonly source?: 'GEMINI' | 'TEMPLATE';
  readonly at: number;
}

export type PhoneScreen = 'LOCK' | 'RINGING' | 'MISSED';

export const LIVE_DEMO_STEPS: readonly { readonly step: LiveDemoStep; readonly label: string }[] = [
  { step: 'STREAM', label: 'Live traffic' },
  { step: 'HOLD', label: 'Hold' },
  { step: 'CALL', label: 'Automated call' },
  { step: 'KILL_SWITCH', label: 'Kill switch' },
  { step: 'OUTREACH', label: 'Voicemail & email' },
  { step: 'BLOCKED', label: 'Attack blocked' },
  { step: 'TRACE', label: 'Trace & audit' },
  { step: 'DONE', label: 'Protected' },
];

/**
 * At demo time a hold auto-releases 24 s after it is placed, so everything between the hold and the kill switch is
 * kept short; the customer message is requested the moment the hold is known, and the slower Gemini work (the
 * voicemail and the email) comes after the account is safe.
 */
const PAUSE_MS = { SHOW_HOLD: 3_500, OPEN_CASE: 2_500, RING: 4_000, AFTER: 1_500, PAGE: 6_000, APPROVAL_SECONDS: 3 } as const;
const COMMAND_TIMEOUT_MS = 120_000;
/** How long the tour waits for Gemini's draft after the hold before sending sentinel-core's fixed wording. */
const DRAFT_PATIENCE_MS = 25_000;

const sgd = (minorUnits: number): string => `S$${(minorUnits / 100).toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class Stopped extends Error {}

/**
 * The one-click live demo (M§6), as an agent-driven tour of the running product. sentinel-core plays the synthetic
 * DEMO_TAKEOVER_01 through its real control path while the tour moves through the pages; when the gate holds the
 * transfer, the SENTINEL agent works the case in the Investigations action centre: an automated call, then (no
 * answer) a kill switch it proposes and the analyst approves, then a Gemini-written voicemail and email, then the
 * attacker's next attempt meeting the kill switch. The rules decide every hold; Gemini writes the words; the
 * analyst authorises (in the demo, auto-approved after a visible countdown as the demo analyst). Every action is
 * the same recorded, audited API call a click makes. Customer channels are simulated.
 */
@Injectable({ providedIn: 'root' })
export class LiveDemoAutopilot {
  private readonly api = inject(CoreApiClient);
  private readonly router = inject(Router);
  private readonly store = inject(Store);
  private readonly analyst = this.store.selectSignal(sessionFeature.selectAnalystIdentity);

  readonly status = signal<'IDLE' | 'RUNNING' | 'DONE' | 'FAILED'>('IDLE');
  readonly step = signal<LiveDemoStep | null>(null);
  readonly failure = signal<string | null>(null);
  readonly hold = signal<LiveDemoHold | null>(null);
  readonly running = computed(() => this.status() === 'RUNNING');
  readonly visible = computed(() => this.status() !== 'IDLE');

  readonly log = signal<readonly ConsoleLine[]>([]);
  readonly approval = signal<{ readonly text: string; readonly secondsLeft: number } | null>(null);
  readonly phoneScreen = signal<PhoneScreen>('LOCK');
  readonly phoneFeed = signal<readonly PhoneEvent[]>([]);
  readonly phoneOpen = signal<PhoneEvent | null>(null);
  readonly banner = signal<string | null>(null);
  readonly voice = signal(true);

  private readonly commandState = signal<LiveDemoCommand | null>(null);
  /** The action the centre should perform now, or null. */
  readonly command = this.commandState.asReadonly();
  private readonly drafts = new Map<string, Promise<CustomerOutreachProposal | null>>();
  private sequence = 0;
  private pending: { readonly id: number; readonly resolve: (ok: boolean) => void } | null = null;
  private approve: (() => void) | null = null;
  private stopped = false;

  async start(): Promise<void> {
    if (this.running()) return;
    this.reset();
    this.status.set('RUNNING');
    try {
      const identity = this.analyst() ?? 'demo-analyst';
      const started = Date.now();
      const run = firstValueFrom(this.api.post<LiveDemoReport>('/v1/demo/live-demo', { analystIdentity: identity }));
      const report = await Promise.race([run, this.streamTour(started, run)]);
      const finished = report ?? (await run);
      const held = finished.held[0];
      if (!held) throw new Error('The scenario finished without a held transfer.');
      this.hold.set(held);
      this.prefetchOutreach(held.assessmentId);
      await this.workTheCase(finished.runId, held, identity);
      this.status.set('DONE');
    } catch (error) {
      if (this.stopped || error instanceof Stopped) return;
      this.status.set('FAILED');
      this.failure.set(this.describe(error));
      this.say('AGENT', `Stopped: ${this.describe(error)}`);
    } finally {
      this.commandState.set(null);
      this.approval.set(null);
      this.pending = null;
    }
  }

  stop(): void {
    this.stopped = true;
    this.pending?.resolve(false);
    this.pending = null;
    this.approve = null;
    this.commandState.set(null);
    this.approval.set(null);
    this.silence();
    this.status.set('IDLE');
    this.step.set(null);
  }

  /** The analyst approves the agent's proposal now instead of waiting for the countdown. */
  approveNow(): void {
    this.approve?.();
  }

  toggleVoice(): void {
    this.voice.update((on) => !on);
    if (!this.voice()) this.silence();
  }

  /** Called by the action centre when it has finished (or could not finish) the command it was given. */
  complete(id: number, ok: boolean): void {
    if (this.pending?.id !== id) return;
    this.pending.resolve(ok);
    this.pending = null;
    this.commandState.set(null);
  }

  /** The customer message requested for this assessment when the hold was reported, if there is one. */
  prefetchedOutreach(assessmentId: string): Promise<CustomerOutreachProposal | null> | null {
    return this.drafts.get(assessmentId) ?? null;
  }

  /** While the scenario plays (about 45 s), the tour shows the product reacting to it, timed to its steps. */
  private async streamTour(started: number, run: Promise<LiveDemoReport>): Promise<null> {
    let done = false;
    void run.then(
      () => (done = true),
      () => (done = true),
    );
    const until = async (offsetMs: number) => {
      while (!done && Date.now() - started < offsetMs) await sleep(250);
      this.guard();
      return !done;
    };
    const [login, payee, first, second, , third, , fourth] = DEMO_TAKEOVER_01.steps;

    this.at('STREAM');
    await this.router.navigateByUrl('/control-tower');
    this.say('AGENT', 'Live demo started. Synthetic traffic from three banks is flowing into SENTINEL; every transfer is decided before it commits.');
    if (!(await until(9_000))) return null;
    await this.router.navigateByUrl('/live-transactions');
    this.say('RULES', 'Each row is a decision: seven deterministic rules score it and the rapid-drain gate decides ALLOW or HOLD.');
    if (!(await until(login.atMs))) return null;
    this.say('BANK', `${DEMO_TAKEOVER_01.accountDisplayId}: login from a device never seen before (${DEMO_TAKEOVER_01.newDeviceId}).`);
    if (!(await until(payee.atMs))) return null;
    this.say('BANK', `${DEMO_TAKEOVER_01.accountDisplayId}: a new payee is added from that device. The account enters cooling-off.`);
    if (first.action === 'TRANSFER' && (await until(first.atMs))) this.say('RULES', `Transfer ${sgd(first.amount)} to the new payee: risk ${first.expectedScore}, ALLOW.`);
    if (second.action === 'TRANSFER' && (await until(second.atMs))) {
      this.say('RULES', `Transfer ${sgd(second.amount)}: risk ${second.expectedScore}, drain ${second.expectedDrainPercent}% of the opening balance. Still under the 50% line.`);
    }
    if (third.action === 'TRANSFER' && (await until(third.atMs))) {
      this.say('RULES', `Transfer ${sgd(third.amount)}: risk ${third.expectedScore}, drain ${third.expectedDrainPercent}%. The account is promoted to the alert queue.`);
      await this.router.navigateByUrl('/alerts');
    }
    if (fourth.action === 'TRANSFER' && (await until(fourth.atMs))) this.say('RULES', `Transfer ${sgd(fourth.amount)} requested…`);
    return null;
  }

  private async workTheCase(runId: string, held: LiveDemoHold, identity: string): Promise<void> {
    // The hold: the rules decided, the customer was notified at once.
    this.at('HOLD');
    this.say('RULES', `HOLD. ${sgd(held.amount)} takes the 24-hour drain past 50% (SG-RD-50). Risk ${held.riskScore}/100. The transfer does not leave the bank.`);
    this.push('PUSH', 'Your bank', `We have paused a transfer of ${sgd(held.amount)} from your account. If this wasn't you, call the number on the back of your card.`);
    this.say('BANK', 'Customer push notification sent.');
    await this.router.navigate(['/live-transactions'], { queryParams: { txn: held.transactionId } });
    await this.pause(PAUSE_MS.SHOW_HOLD);

    this.store.dispatch(AlertsActions.accountSelected({ accountId: held.accountId }));
    await this.router.navigateByUrl('/investigations');
    this.say('AGENT', 'Case opened in Investigations. Evidence bundle compiled; Gemini is drafting the customer outreach from it.');
    await this.pause(PAUSE_MS.OPEN_CASE);

    // The automated call: the line rings, nobody answers.
    this.at('CALL');
    this.say('AGENT', 'Placing an automated security call to the customer…');
    this.phoneScreen.set('RINGING');
    const called = this.issue('CALL', held.accountId);
    await this.pause(PAUSE_MS.RING);
    this.phoneScreen.set('MISSED');
    this.push('CALL', 'Missed call', 'Your bank (automated security call)');
    await called;
    this.say('CUSTOMER', 'No answer.');

    // The kill switch: the agent proposes, the analyst approves.
    this.at('KILL_SWITCH');
    await this.requestApproval(`Activate the kill switch on ${DEMO_TAKEOVER_01.accountDisplayId}? The customer cannot be reached and a takeover is suspected.`);
    this.say('ANALYST', `${identity} approved the kill switch.`);
    await this.issue('KILL_SWITCH', held.accountId);
    this.flash(`Kill switch active on ${DEMO_TAKEOVER_01.accountDisplayId}`);
    this.say('RULES', 'Kill switch active: the held transfer and every further outflow stay held until the customer verifies with the bank.');
    this.push('PUSH', 'Your bank', 'For your security, outgoing transfers from your account are paused until you verify with us.');
    this.phoneScreen.set('LOCK');
    await this.pause(PAUSE_MS.AFTER);

    // The words: Gemini's voicemail and email, sent through simulated channels.
    this.at('OUTREACH');
    const proposal = await (this.drafts.get(held.assessmentId) ?? Promise.resolve(null));
    this.guard();
    const source = proposal?.source ?? 'TEMPLATE';
    this.say(
      'GEMINI',
      source === 'GEMINI'
        ? 'Drafted the voicemail and email from the evidence bundle: no links, no requests for secrets.'
        : proposal && !proposal.model
          ? 'Still drafting after 25 seconds, so sentinel-core sends its fixed wording now.'
          : 'Unavailable: sentinel-core sends its fixed wording instead.',
    );
    await this.issue('VOICEMAIL', held.accountId);
    if (proposal) this.open('VOICEMAIL', 'Voicemail from your bank', proposal.draft.callScript, source);
    this.speak(proposal?.draft.callScript ?? '');
    await this.pause(PAUSE_MS.PAGE);
    await this.issue('EMAIL', held.accountId);
    if (proposal) this.open('EMAIL', proposal.draft.subject, proposal.draft.emailBody, source);
    this.say('AGENT', 'Voicemail left and email sent; both recorded against the case.');
    await this.pause(PAUSE_MS.PAGE);
    this.phoneOpen.set(null);

    // The attacker tries again and meets the kill switch.
    this.at('BLOCKED');
    this.say('BANK', 'The attacker tries again: S$9,800.00 to the same mule account from the same new device…');
    const attempt = await firstValueFrom(this.api.post<DecisionResponse>(`/v1/demo/live-demo/${encodeURIComponent(runId)}/follow-up-transfer`, { analystIdentity: identity }));
    this.guard();
    const blocked = attempt.decision !== 'ALLOW';
    // Whatever code the gate returned is what the console says: the drain gate outranks the kill switch when the
    // transfer itself breaches the line, and the kill switch holds anything the drain gate alone would let through.
    this.say(
      'RULES',
      !blocked
        ? 'ALLOW: this transfer was not held.'
        : attempt.policyCodes.includes('KILL_SWITCH')
          ? 'HOLD (KILL_SWITCH): stopped by the kill switch. The money stays in the account.'
          : `HOLD (${attempt.policyCodes.join(', ') || attempt.reasonCodes.join(', ')}): still over the 50% drain line, and the kill switch would hold it even below the line. The money stays in the account.`,
    );
    const original = await firstValueFrom(this.api.get<{ readonly history: readonly Intervention[] }>(`/v1/interventions/${encodeURIComponent(held.transactionId)}`)).catch(() => null);
    this.guard();
    const state = original?.history.at(-1)?.state;
    if (state === 'HELD') {
      this.say('RULES', `The first ${sgd(held.amount)} transfer is past its 24-second demo cooling period and still held: the kill switch stops the auto-release until the customer verifies.`);
    } else if (state) {
      this.say('RULES', `The first ${sgd(held.amount)} transfer is now ${state.toLowerCase()}.`);
    }
    if (blocked) this.push('PUSH', 'Your bank', 'A transfer of S$9,800.00 was stopped because your account is protected. Please verify with us.');
    await this.router.navigate(['/live-transactions'], { queryParams: { txn: attempt.transactionId } });
    await this.pause(PAUSE_MS.PAGE);

    // Where the money was going, and the record of everything.
    this.at('TRACE');
    await this.router.navigateByUrl('/network-analysis');
    this.say('AGENT', 'Where was the money going? The entity graph links the mule payee across banks and stops at the observed boundary.');
    await this.pause(PAUSE_MS.PAGE);
    await this.router.navigateByUrl('/audit-logs');
    this.say('AGENT', 'Every action is in the audit log: the hold, the call, the kill switch, the voicemail and the email, each with who and when.');
    await this.pause(PAUSE_MS.PAGE);

    this.at('DONE');
    this.say('AGENT', 'Account protected. Rules decided, Gemini wrote the words, the analyst authorised. Synthetic data throughout.');
    this.store.dispatch(AlertsActions.accountSelected({ accountId: held.accountId }));
    await this.router.navigateByUrl('/investigations');
  }

  /** The agent never acts on the account alone: the analyst approves, here after a visible countdown. */
  private async requestApproval(text: string): Promise<void> {
    this.say('AGENT', `Proposal: ${text}`);
    await new Promise<void>((resolve) => {
      let secondsLeft: number = PAUSE_MS.APPROVAL_SECONDS;
      const finish = () => {
        clearInterval(timer);
        this.approve = null;
        this.approval.set(null);
        resolve();
      };
      const timer = setInterval(() => {
        secondsLeft -= 1;
        if (secondsLeft <= 0 || this.stopped) finish();
        else this.approval.set({ text, secondsLeft });
      }, 1000);
      this.approval.set({ text, secondsLeft });
      this.approve = finish;
    });
    this.guard();
  }

  private reset(): void {
    this.stopped = false;
    this.failure.set(null);
    this.hold.set(null);
    this.log.set([]);
    this.phoneFeed.set([]);
    this.phoneOpen.set(null);
    this.phoneScreen.set('LOCK');
    this.banner.set(null);
    this.drafts.clear();
  }

  private at(step: LiveDemoStep): void {
    this.step.set(step);
  }

  private say(speaker: ConsoleSpeaker, text: string): void {
    this.log.update((lines) => [...lines, { id: ++this.sequence, speaker, text }].slice(-40));
  }

  private push(kind: PhoneEvent['kind'], title: string, body: string, source?: PhoneEvent['source']): PhoneEvent {
    const event: PhoneEvent = { id: ++this.sequence, kind, title, body, at: Date.now(), ...(source ? { source } : {}) };
    this.phoneFeed.update((feed) => [event, ...feed].slice(0, 6));
    return event;
  }

  private open(kind: 'VOICEMAIL' | 'EMAIL', title: string, body: string, source: PhoneEvent['source']): void {
    this.phoneOpen.set(this.push(kind, title, body, source));
  }

  private flash(text: string): void {
    this.banner.set(text);
    setTimeout(() => {
      if (this.banner() === text) this.banner.set(null);
    }, 3_500);
  }

  private speak(text: string): void {
    if (!this.voice() || !text || typeof speechSynthesis === 'undefined') return;
    try {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-SG';
      utterance.rate = 1.05;
      speechSynthesis.speak(utterance);
    } catch {
      // Voice is a nicety; the transcript on the phone is the record.
    }
  }

  private silence(): void {
    try {
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    } catch {
      // Nothing to stop.
    }
  }

  /**
   * Gemini's draft if it arrives within DRAFT_PATIENCE_MS, otherwise sentinel-core's fixed wording: the tour never
   * stalls on a slow model, and the console says which one went out.
   */
  private prefetchOutreach(assessmentId: string): void {
    const path = `/v1/investigations/${encodeURIComponent(assessmentId)}/customer-outreach`;
    const drafted = firstValueFrom(this.api.post<CustomerOutreachProposal>(path, {})).catch(() => null);
    const patience = sleep(DRAFT_PATIENCE_MS).then(() => 'LATE' as const);
    this.drafts.set(
      assessmentId,
      Promise.race([drafted, patience]).then((first) =>
        first === 'LATE' || first === null ? firstValueFrom(this.api.post<CustomerOutreachProposal>(`${path}?draft=template`, {})).catch(() => null) : first,
      ),
    );
  }

  private async issue(kind: LiveDemoCommandKind, accountId: string): Promise<void> {
    this.guard();
    const id = ++this.sequence;
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
    await sleep(ms);
    this.guard();
  }

  private guard(): void {
    if (this.stopped) throw new Stopped();
  }

  private describe(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) return 'sentinel-core is unreachable, so the live demo could not run.';
      if (error.status === 409) return 'A live demo is already running. Wait about a minute and try again.';
      return `sentinel-core refused a live demo step (HTTP ${error.status}).`;
    }
    return error instanceof Error ? error.message : 'The live demo stopped unexpectedly.';
  }
}
