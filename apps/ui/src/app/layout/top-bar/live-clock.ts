import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';

const SINGAPORE_TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Singapore',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});
const SINGAPORE_DATE = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Singapore',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** "Sun, 27 Sep 2026": day before month, three-letter month. */
function formatDate(now: Date): string {
  const part = (type: Intl.DateTimeFormatPartTypes) => SINGAPORE_DATE.formatToParts(now).find((candidate) => candidate.type === type)?.value ?? '';
  return `${part('weekday')}, ${part('day')} ${part('month')} ${part('year')}`;
}

/** Operator wall clock in Singapore time; policy timestamps elsewhere stay in UTC. */
@Component({
  selector: 'sentinel-live-clock',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <time class="time sentinel-mono">{{ time() }}</time>
    <span class="date">{{ date() }} · SGT</span>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      line-height: 1.2;
    }
    .time {
      font-size: 0.9375rem;
      font-weight: 600;
    }
    .date {
      font-size: 0.6875rem;
      color: var(--sentinel-color-text-secondary);
      white-space: nowrap;
    }
  `,
})
export class LiveClock {
  protected readonly time = signal('');
  protected readonly date = signal('');

  constructor() {
    const tick = () => {
      const now = new Date();
      this.time.set(SINGAPORE_TIME.format(now));
      this.date.set(formatDate(now));
    };
    tick();
    const timer = setInterval(tick, 1_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
