import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, effect, inject, input, output, signal } from '@angular/core';
import { MinorUnitsCurrencyPipe } from '../../../../shared/pipes/minor-units-currency/minor-units-currency-pipe';
import { Icon } from '../../../../shared/ui/icon/icon';
import type { GraphTimelineEntry } from '../../graph-engine/evidence-graph';

const PLAY_STEP_MS = 1_600;
const ICON: Readonly<Record<GraphTimelineEntry['kind'], 'transfer' | 'server' | 'account' | 'shieldAlert'>> = {
  TRANSFER: 'transfer',
  DEVICE: 'server',
  PAYEE: 'account',
  INTERVENTION: 'shieldAlert',
};

/**
 * The case's moments in time order: transfers, device and payee events, interventions. Choosing one focuses the
 * graph on what it touched; play walks through them in order. Nothing here is inferred: every card is a record.
 */
@Component({
  selector: 'sentinel-flow-timeline',
  imports: [DatePipe, Icon, MinorUnitsCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header>
      <h2>Transaction flow timeline <span>(selected case)</span></h2>
      <button type="button" class="play" [attr.aria-label]="playing() ? 'Stop playback' : 'Play the timeline'" [attr.aria-pressed]="playing()" (click)="toggle()" [disabled]="entries().length === 0">
        <sentinel-icon [name]="playing() ? 'pause' : 'play'" [size]="16" />
      </button>
      @if (entries().length > 0) {
        <span class="range sentinel-mono">{{ entries()[0]!.at | date: 'd MMM, HH:mm' : 'UTC' }} → {{ entries()[entries().length - 1]!.at | date: 'd MMM, HH:mm' : 'UTC' }}</span>
      }
    </header>
    <ol class="rail sentinel-scroll">
      @for (entry of entries(); track entry.id) {
        <li>
          <span class="tick" [attr.data-tone]="entry.tone" aria-hidden="true"></span>
          <button type="button" [attr.data-id]="entry.id" [attr.data-tone]="entry.tone" [attr.aria-pressed]="active() === entry.id" (click)="chosen.emit(entry)">
            <span class="icon"><sentinel-icon [name]="icon[entry.kind]" [size]="16" /></span>
            <span class="text">
              <span class="when sentinel-mono">{{ entry.at | date: 'd MMM, HH:mm:ss' : 'UTC' }}</span>
              <b>{{ entry.amount !== null ? (entry.amount | minorUnitsCurrency) : entry.title }}</b>
              <span class="detail">{{ entry.detail }}</span>
            </span>
          </button>
        </li>
      } @empty {
        <li class="empty">No recorded activity for this case yet.</li>
      }
    </ol>
  `,
  styleUrl: './flow-timeline.css',
})
export class FlowTimeline {
  readonly entries = input<readonly GraphTimelineEntry[]>([]);
  readonly active = input<string | null>(null);
  readonly chosen = output<GraphTimelineEntry>();

  protected readonly icon = ICON;
  protected readonly playing = signal(false);
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
    // Keep the focused card in view, inside the rail only: the page never scrolls.
    effect(() => {
      const id = this.active();
      if (!id) return;
      const card = this.host.nativeElement.querySelector<HTMLElement>(`button[data-id="${CSS.escape(id)}"]`);
      const rail = this.host.nativeElement.querySelector<HTMLElement>('.rail');
      if (card && rail) rail.scrollTo({ left: card.offsetLeft - rail.clientWidth / 2 + card.offsetWidth / 2, behavior: 'smooth' });
    });
    effect(() => {
      // A new case stops playback.
      this.entries();
      this.stop();
    });
  }

  protected toggle(): void {
    if (this.playing()) {
      this.stop();
      return;
    }
    const entries = this.entries();
    if (entries.length === 0) return;
    this.playing.set(true);
    let index = Math.max(0, entries.findIndex((entry) => entry.id === this.active()) + 1) % entries.length;
    const step = () => {
      const entry = entries[index];
      if (!entry) return this.stop();
      if (this.active() !== entry.id) this.chosen.emit(entry);
      index += 1;
      if (index >= entries.length) this.stop();
    };
    step();
    if (this.playing()) this.timer = setInterval(step, PLAY_STEP_MS);
  }

  private stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.playing.set(false);
  }
}
