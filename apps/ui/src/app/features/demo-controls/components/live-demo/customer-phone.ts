import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { LiveDemoAutopilot } from '../../data-access/live-demo-autopilot';

const TYPE_MS = 18;

/**
 * The synthetic customer's phone: what the bank's simulated channels deliver, as the customer would see it. The
 * push notifications, the automated call ringing and going unanswered, and the voicemail and email Gemini drafted,
 * typed out as they arrive. Nothing here reaches a real person.
 */
@Component({
  selector: 'sentinel-customer-phone',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="phone" aria-label="The synthetic customer's phone (simulated)">
      <div class="notch" aria-hidden="true"></div>
      <figcaption>Customer's phone · simulated</figcaption>

      @switch (demo.phoneScreen()) {
        @case ('RINGING') {
          <div class="call ringing" role="status">
            <span class="ring" aria-hidden="true">📞</span>
            <b>Your bank</b>
            <span>Automated security call…</span>
            <span class="buttons" aria-hidden="true"><i class="decline"></i><i class="accept"></i></span>
          </div>
        }
        @case ('MISSED') {
          <div class="call missed" role="status">
            <b>Missed call</b>
            <span>Your bank · automated security call</span>
          </div>
        }
      }

      @if (demo.phoneOpen(); as open) {
        <article class="open" [attr.data-kind]="open.kind">
          <header>
            <span class="app">{{ open.kind === 'EMAIL' ? '✉ Mail' : '🎙 Voicemail' }}</span>
            @if (open.source) {
              <span class="source" [attr.data-source]="open.source">{{ open.source === 'GEMINI' ? 'Written by Gemini' : 'Fixed wording' }}</span>
            }
          </header>
          <b class="title">{{ open.title }}</b>
          <p class="body">{{ typed() }}<span class="caret" aria-hidden="true"></span></p>
        </article>
      }

      <ul class="feed" aria-label="Notifications">
        @for (event of demo.phoneFeed(); track event.id) {
          <li [attr.data-kind]="event.kind">
            <span class="icon" aria-hidden="true">{{ icon(event.kind) }}</span>
            <span class="text">
              <b>{{ event.title }}</b>
              <span>{{ event.body }}</span>
            </span>
            <time>{{ event.at | date: 'HH:mm' }}</time>
          </li>
        } @empty {
          <li class="empty">No notifications</li>
        }
      </ul>
    </figure>
  `,
  styles: `
    .phone {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 290px;
      height: 520px;
      margin: 0;
      padding: 30px 12px 14px;
      border: 8px solid #111;
      border-radius: 36px;
      background: linear-gradient(170deg, #1d2b4a 0%, #0f172a 60%, #111827 100%);
      color: #f8fafc;
      box-shadow: 0 24px 60px rgb(0 0 0 / 40%);
      overflow: hidden;
      font-size: 0.75rem;
    }
    .notch {
      position: absolute;
      top: 6px;
      left: 50%;
      width: 90px;
      height: 18px;
      border-radius: 12px;
      background: #000;
      transform: translateX(-50%);
    }
    figcaption {
      text-align: center;
      color: #94a3b8;
      font-size: 0.625rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .call {
      display: grid;
      justify-items: center;
      gap: 4px;
      padding: 14px 10px;
      border-radius: 18px;
      background: rgb(255 255 255 / 10%);
      text-align: center;
    }
    .call b {
      font-size: 1rem;
    }
    .ring {
      font-size: 1.75rem;
      animation: ring 0.5s ease-in-out infinite alternate;
    }
    .buttons {
      display: flex;
      gap: 40px;
      margin-top: 6px;
    }
    .buttons i {
      width: 38px;
      height: 38px;
      border-radius: 50%;
    }
    .decline {
      background: #ef4444;
    }
    .accept {
      background: #22c55e;
      animation: pulse 1s ease-in-out infinite;
    }
    .missed {
      background: rgb(239 68 68 / 22%);
    }
    .open {
      display: grid;
      gap: 6px;
      padding: 10px 12px;
      border-radius: 16px;
      background: #f8fafc;
      color: #0f172a;
      animation: drop 0.35s ease-out;
    }
    .open header {
      display: flex;
      justify-content: space-between;
      gap: 6px;
      font-size: 0.6875rem;
      color: #475569;
    }
    .source {
      padding: 0 6px;
      border-radius: 999px;
      background: #dbeafe;
      color: #1d4ed8;
      font-weight: 700;
    }
    .source[data-source='TEMPLATE'] {
      background: #e2e8f0;
      color: #334155;
    }
    .title {
      font-size: 0.8125rem;
    }
    .body {
      max-height: 190px;
      margin: 0;
      overflow: auto;
      line-height: 1.45;
      white-space: pre-line;
    }
    .caret {
      display: inline-block;
      width: 6px;
      height: 12px;
      margin-left: 1px;
      background: #2563eb;
      vertical-align: text-bottom;
      animation: blink 0.8s steps(2) infinite;
    }
    .feed {
      display: grid;
      gap: 6px;
      margin: auto 0 0;
      padding: 0;
      list-style: none;
    }
    .feed li {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 8px;
      align-items: start;
      padding: 8px 10px;
      border-radius: 14px;
      background: rgb(255 255 255 / 12%);
      backdrop-filter: blur(6px);
      animation: drop 0.35s ease-out;
    }
    .feed li:first-child {
      background: rgb(255 255 255 / 20%);
    }
    .feed .text {
      display: grid;
      gap: 2px;
      min-width: 0;
    }
    .feed .text span {
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      color: #cbd5e1;
    }
    .feed time {
      color: #94a3b8;
      font-size: 0.625rem;
    }
    .empty {
      grid-template-columns: 1fr !important;
      color: #94a3b8;
      text-align: center;
    }
    @keyframes ring {
      from { transform: rotate(-14deg); }
      to { transform: rotate(14deg); }
    }
    @keyframes pulse {
      50% { transform: scale(1.15); }
    }
    @keyframes drop {
      from { opacity: 0; transform: translateY(-10px); }
    }
    @keyframes blink {
      50% { opacity: 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .ring, .accept, .open, .feed li, .caret {
        animation: none;
      }
    }
  `,
})
export class CustomerPhone {
  protected readonly demo = inject(LiveDemoAutopilot);
  private readonly shown = signal(0);
  protected readonly typed = computed(() => (this.demo.phoneOpen()?.body ?? '').slice(0, this.shown()));

  constructor() {
    // The voicemail and the email are typed out as they arrive, at roughly speaking speed.
    effect((onCleanup) => {
      const open = this.demo.phoneOpen();
      untracked(() => this.shown.set(0));
      if (!open) return;
      const timer = setInterval(() => {
        if (this.shown() >= open.body.length) clearInterval(timer);
        else this.shown.update((count) => count + 3);
      }, TYPE_MS);
      onCleanup(() => clearInterval(timer));
    });
  }

  protected icon(kind: string): string {
    return kind === 'CALL' ? '📞' : kind === 'VOICEMAIL' ? '🎙' : kind === 'EMAIL' ? '✉' : '🏦';
  }
}
