import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterRenderEffect, computed, effect, inject, input, output, signal } from '@angular/core';
import { MinorUnitsCurrencyPipe } from '../../../../shared/pipes/minor-units-currency/minor-units-currency-pipe';
import { Icon } from '../../../../shared/ui/icon/icon';
import type { GraphTimelineEntry } from '../../graph-engine/evidence-graph';

/** How long playback stays on each moment; the card's progress bar and the graph's pulse share this beat. */
export const PLAY_STEP_MS = 1_600;
const ICON: Readonly<Record<GraphTimelineEntry['kind'], 'transfer' | 'server' | 'account' | 'shieldAlert'>> = {
  TRANSFER: 'transfer',
  DEVICE: 'server',
  PAYEE: 'account',
  INTERVENTION: 'shieldAlert',
};

/**
 * The case's moments in time order: transfers, device and payee events, interventions. Choosing one focuses the
 * graph on what it touched; play walks through them in order. The rail follows the graph too: the moment in focus
 * glows and the axis fills up to it, and an entity or link chosen on the graph lights the moments that touched it.
 * Nothing here is inferred: every card is a record.
 */
@Component({
  selector: 'sentinel-flow-timeline',
  imports: [DatePipe, Icon, MinorUnitsCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-playing]': 'playing() ? "" : null', '[style.--step-ms]': 'stepMs + "ms"' },
  template: `
    <header>
      <h2>Transaction flow timeline <span>(selected case)</span></h2>
      <button type="button" class="play" [attr.aria-label]="playing() ? 'Stop playback' : 'Play the timeline'" [attr.aria-pressed]="playing()" (click)="toggle()" [disabled]="entries().length === 0">
        <sentinel-icon [name]="playing() ? 'pause' : 'play'" [size]="16" />
      </button>
      @if (activeIndex() >= 0) {
        <span class="step" role="status">Step {{ activeIndex() + 1 }} of {{ entries().length }}</span>
      } @else if (linked().length > 0) {
        <span class="step linked" role="status">{{ linked().length }} {{ linked().length === 1 ? 'moment touches' : 'moments touch' }} the selection</span>
      }
      @if (entries().length > 0) {
        <span class="range sentinel-mono">{{ entries()[0]!.at | date: 'd MMM, HH:mm' : 'UTC' }} → {{ entries()[entries().length - 1]!.at | date: 'd MMM, HH:mm' : 'UTC' }}</span>
      }
    </header>
    <ol class="rail sentinel-scroll" [style.--progress]="progressPx() + 'px'">
      @for (entry of entries(); track entry.id; let index = $index) {
        <li [attr.data-state]="stateOf(index)" [attr.data-linked]="linkedSet().has(entry.id) ? '' : null">
          <span class="tick" [attr.data-tone]="entry.tone" aria-hidden="true"></span>
          <button type="button" [attr.data-id]="entry.id" [attr.data-tone]="entry.tone" [attr.aria-pressed]="active() === entry.id" (click)="choose(entry)">
            <span class="icon"><sentinel-icon [name]="icon[entry.kind]" [size]="16" /></span>
            <span class="text">
              <span class="when sentinel-mono">{{ entry.at | date: 'd MMM, HH:mm:ss' : 'UTC' }}</span>
              <b>{{ entry.amount !== null ? (entry.amount | minorUnitsCurrency) : entry.title }}</b>
              <span class="detail">{{ entry.detail }}</span>
            </span>
            @if (active() === entry.id) {
              <span class="beat" aria-hidden="true"></span>
            }
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
  /** Moments that touched what is selected on the graph. */
  readonly linked = input<readonly string[]>([]);
  readonly chosen = output<GraphTimelineEntry>();

  protected readonly icon = ICON;
  protected readonly stepMs = PLAY_STEP_MS;
  protected readonly playing = signal(false);
  protected readonly activeIndex = computed(() => this.entries().findIndex((entry) => entry.id === this.active()));
  protected readonly linkedSet = computed(() => new Set(this.linked()));
  /** How far the axis is lit: up to the centre of the moment in focus. */
  protected readonly progressPx = signal(0);
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
    // Keep the focused moment (or the first one the graph selection touches) in view, inside the rail only.
    afterRenderEffect(() => {
      const id = this.active() ?? this.linked()[0] ?? null;
      const index = this.activeIndex();
      const rail = this.host.nativeElement.querySelector<HTMLElement>('.rail');
      const card = id ? this.host.nativeElement.querySelector<HTMLElement>(`button[data-id="${CSS.escape(id)}"]`) : null;
      const centre = card ? (card.parentElement?.offsetLeft ?? 0) + card.offsetWidth / 2 : 0;
      this.progressPx.set(index >= 0 && card ? centre : 0);
      if (card && rail) rail.scrollTo({ left: centre - rail.clientWidth / 2, behavior: 'smooth' });
    });
    effect(() => {
      // A new case stops playback.
      this.entries();
      this.stop();
    });
  }

  protected stateOf(index: number): 'past' | 'now' | 'next' | null {
    const active = this.activeIndex();
    if (active < 0) return null;
    return index < active ? 'past' : index === active ? 'now' : 'next';
  }

  protected choose(entry: GraphTimelineEntry): void {
    this.stop();
    this.chosen.emit(entry);
  }

  protected toggle(): void {
    if (this.playing()) {
      this.stop();
      return;
    }
    const entries = this.entries();
    if (entries.length === 0) return;
    this.playing.set(true);
    let index = Math.max(0, this.activeIndex() + 1) % entries.length;
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
