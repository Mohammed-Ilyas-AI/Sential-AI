import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { DEMO_TIME_COMPRESSION_FACTOR } from '@sentinel/domain';
import { RUNTIME_CONFIG } from '../../../../core/config/runtime-config';
import { MinorUnitsCurrencyPipe } from '../../../../shared/pipes/minor-units-currency/minor-units-currency-pipe';
import { Icon } from '../../../../shared/ui/icon/icon';
import { LiveDemoAutopilot, type LiveDemoCommand } from '../../../demo-controls';
import { AccountControlsFacade } from '../../data-access/account-controls-facade';
import { InterventionsFacade, type InterventionAction, type InterventionRow } from '../../data-access/interventions-facade';

type KillSwitchStep = 'IDLE' | 'CONFIRM';
type CallState = 'IDLE' | 'RINGING' | 'ASK_OUTCOME';

interface ArmedAction {
  readonly action: InterventionAction;
  readonly transactionId: string;
}

const ACTION_LABELS: Readonly<Record<InterventionAction, { readonly label: string; readonly confirm: string }>> = {
  'customer-verified-release': { label: 'Release · customer verified', confirm: 'Record that the customer verified with the bank and release' },
  'customer-cancellation': { label: 'Cancel · customer request', confirm: 'Record that the customer cancelled this transfer' },
  'fraud-confirmation': { label: 'Confirm fraud', confirm: 'Confirm fraud and reject, recorded as' },
};
const ACTIONS: readonly InterventionAction[] = ['customer-verified-release', 'customer-cancellation', 'fraud-confirmation'];
const RING_MS = 2_500;
const DEMO_STEP_MS = 1_200;
const DEFAULT_KILL_SWITCH_REASON = 'Customer unreachable after an automated call and email; account takeover suspected.';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Everything an analyst does about one account, in one visible place (M§5.3): the policy holds and their three
 * exceptions, system-generated customer outreach (an automated call and an email, both drafted by Gemini or
 * sentinel-core's fixed wording), and the kill switch. Rules decide the hold; Gemini writes the words; every
 * action here is the analyst's, recorded and audited by sentinel-core. Channels are simulated.
 */
@Component({
  selector: 'sentinel-action-centre',
  imports: [DatePipe, Icon, MinorUnitsCurrencyPipe],
  providers: [InterventionsFacade, AccountControlsFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './action-centre.html',
  styleUrl: './action-centre.css',
})
export class ActionCentre {
  readonly accountId = input.required<string>();
  readonly reference = input.required<string>();
  readonly assessmentId = input.required<string>();
  readonly transactionId = input<string | null>(null);

  protected readonly holds = inject(InterventionsFacade);
  protected readonly controls = inject(AccountControlsFacade);
  private readonly demo = inject(LiveDemoAutopilot);
  protected readonly demoTime = inject(RUNTIME_CONFIG).demoTimeCompression;
  protected readonly factor = DEMO_TIME_COMPRESSION_FACTOR;
  protected readonly labels = ACTION_LABELS;
  protected readonly actions = ACTIONS;

  protected readonly armed = signal<ArmedAction | null>(null);
  protected readonly now = signal(Date.now());
  protected readonly killStep = signal<KillSwitchStep>('IDLE');
  protected readonly reason = signal(DEFAULT_KILL_SWITCH_REASON);
  protected readonly call = signal<CallState>('IDLE');
  protected readonly shown = signal<'CALL' | 'EMAIL' | null>(null);
  /** The control the live demo is about to press, highlighted so the audience can follow it. */
  protected readonly spotlight = signal<'CALL' | 'VOICEMAIL' | 'EMAIL' | 'KILL_SWITCH' | null>(null);

  private readonly accountRows = computed(() => this.holds.rows().filter((row) => row.accountId === this.accountId()));
  protected readonly held = computed<readonly InterventionRow[]>(() => {
    const focus = this.transactionId();
    return this.accountRows()
      .filter((row) => row.state === 'HELD')
      .sort((a, b) => Number(b.transactionId === focus) - Number(a.transactionId === focus) || b.heldAt.localeCompare(a.heldAt));
  });
  protected readonly resolved = computed(() =>
    this.accountRows()
      .filter((row) => row.state !== 'HELD')
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 2),
  );

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));

    effect(() => {
      const accountId = this.accountId();
      untracked(() => {
        this.armed.set(null);
        this.killStep.set('IDLE');
        this.reason.set(DEFAULT_KILL_SWITCH_REASON);
        this.call.set('IDLE');
        this.shown.set(null);
        this.controls.load(accountId);
      });
    });

    // The live demo works the case here, on screen, through the same methods the buttons call.
    effect(() => {
      const command = this.demo.command();
      if (!command || command.accountId !== this.accountId()) return;
      untracked(() => void this.perform(command));
    });
  }

  protected secondsLeft(row: InterventionRow): number | null {
    if (!row.holdUntil) return null;
    return Math.max(0, Math.ceil((Date.parse(row.holdUntil) - this.now()) / 1000));
  }

  protected resolution(row: InterventionRow): string {
    const by = row.actor === 'SYSTEM' ? 'the rule engine (cooling period ended)' : row.actor === 'CUSTOMER' ? 'the customer' : (row.actorIdentity ?? 'the analyst');
    return `${row.state.toLowerCase()} by ${by}`;
  }

  protected channelLabel(channel: string): string {
    return channel === 'AUTOMATED_CALL' ? 'automated call' : channel.replace('_', ' ').toLowerCase();
  }

  protected value(event: Event): string {
    return (event.target as HTMLTextAreaElement).value;
  }

  protected arm(action: InterventionAction, transactionId: string): void {
    this.armed.set({ action, transactionId });
  }

  protected confirmHoldAction({ action, transactionId }: ArmedAction): void {
    this.holds.select(transactionId);
    this.holds.act(action, transactionId);
    this.armed.set(null);
  }

  /**
   * Dials at once, as an automated call does, while Gemini finishes the script it reads if the customer picks up;
   * then asks the analyst what happened. A draft that is still being written never delays the call.
   */
  protected async placeCall(): Promise<boolean> {
    if (this.call() === 'RINGING') return false;
    this.shown.set('CALL');
    this.call.set('RINGING');
    void this.outreach();
    await wait(RING_MS);
    this.call.set('ASK_OUTCOME');
    return true;
  }

  protected async callOutcome(reached: boolean): Promise<boolean> {
    const ok = await this.controls.recordContact(
      'AUTOMATED_CALL',
      reached ? 'REACHED' : 'NO_ANSWER',
      reached ? 'Automated call answered' : 'Automated call: no answer',
      this.transactionId(),
    );
    if (ok) this.call.set('IDLE');
    return ok;
  }

  /** After an unanswered call, the system leaves the drafted script as a voicemail. */
  protected async leaveVoicemail(): Promise<boolean> {
    this.shown.set('CALL');
    const proposal = await this.outreach();
    if (!proposal) return false;
    const by = proposal.source === 'GEMINI' ? 'drafted by Gemini' : 'fixed wording';
    return this.controls.recordContact('AUTOMATED_CALL', 'MESSAGE_LEFT', `Voicemail left (${by})`, this.transactionId());
  }

  protected async sendEmail(): Promise<boolean> {
    this.shown.set('EMAIL');
    const proposal = await this.outreach();
    if (!proposal) return false;
    return this.controls.recordContact('EMAIL', 'NOTIFICATION_SENT', `Email: ${proposal.draft.subject}`, this.transactionId());
  }

  protected async confirmKillSwitch(): Promise<boolean> {
    const ok = await this.controls.activateKillSwitch(this.reason().trim());
    if (ok) this.killStep.set('IDLE');
    return ok;
  }

  private async outreach() {
    const assessmentId = this.assessmentId();
    const requested = this.demo.prefetchedOutreach(assessmentId);
    const ready = requested ? await requested : null;
    if (ready) this.controls.adoptOutreach(assessmentId, ready);
    return this.controls.draftOutreach(assessmentId);
  }

  private async perform(command: LiveDemoCommand): Promise<void> {
    this.spotlight.set(command.kind);
    let ok = false;
    try {
      await wait(DEMO_STEP_MS);
      if (command.kind === 'CALL') {
        // Synthetic customers never pick up: the takeover victim is unreachable by design of the scenario.
        ok = (await this.placeCall()) && (await wait(DEMO_STEP_MS).then(() => this.callOutcome(false)));
      } else if (command.kind === 'VOICEMAIL') {
        ok = await this.leaveVoicemail();
      } else if (command.kind === 'EMAIL') {
        ok = await this.sendEmail();
      } else if (this.controls.killSwitch()?.active) {
        ok = true;
      } else {
        this.reason.set(DEFAULT_KILL_SWITCH_REASON);
        this.killStep.set('CONFIRM');
        await wait(DEMO_STEP_MS);
        ok = await this.confirmKillSwitch();
      }
    } finally {
      this.spotlight.set(null);
      this.demo.complete(command.id, ok);
    }
  }
}
