import type { ElementRef } from '@angular/core';
import { ChangeDetectionStrategy, Component, computed, effect, inject, viewChild } from '@angular/core';
import { Icon } from '../../../../shared/ui/icon/icon';
import { LIVE_DEMO_STEPS, LiveDemoAutopilot, type ConsoleSpeaker } from '../../data-access/live-demo-autopilot';
import { CustomerPhone } from './customer-phone';

const SPEAKERS: Readonly<Record<ConsoleSpeaker, string>> = {
  BANK: 'Bank',
  RULES: 'Rules engine',
  GEMINI: 'Gemini',
  AGENT: 'SENTINEL agent',
  ANALYST: 'Analyst',
  CUSTOMER: 'Customer',
};

/**
 * The live demo's overlays: the agent console (what each actor is doing, attributed, with the analyst's approval
 * step), the customer's phone, and a banner when the kill switch lands. The pages underneath are the real ones.
 */
@Component({
  selector: 'sentinel-live-demo-narrator',
  imports: [Icon, CustomerPhone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (demo.visible()) {
      @if (demo.banner(); as banner) {
        <div class="banner" role="alert"><span aria-hidden="true">🔒</span> {{ banner }}</div>
      }

      <aside class="console" aria-label="Live demo agent console">
        <header>
          <span class="tag"><span class="dot" [class.live]="demo.running()" aria-hidden="true"></span> LIVE DEMO · agent console · synthetic data</span>
          <button type="button" class="icon" (click)="demo.toggleVoice()" [attr.aria-pressed]="demo.voice()" [attr.aria-label]="demo.voice() ? 'Mute the voicemail voice' : 'Read the voicemail aloud'">
            {{ demo.voice() ? '🔊' : '🔇' }}
          </button>
          <button type="button" class="icon" (click)="demo.stop()" [attr.aria-label]="demo.running() ? 'Stop the live demo' : 'Close the live demo'">
            <sentinel-icon name="close" [size]="16" />
          </button>
        </header>

        <ol class="steps">
          @for (item of steps; track item.step; let index = $index) {
            <li [attr.data-state]="index < current() ? 'done' : index === current() ? 'now' : 'next'">{{ item.label }}</li>
          }
        </ol>

        <ol class="log sentinel-scroll" #log aria-live="polite">
          @for (line of demo.log(); track line.id) {
            <li [attr.data-speaker]="line.speaker">
              <b>{{ speakers[line.speaker] }}</b>
              <span>{{ line.text }}</span>
            </li>
          }
        </ol>

        @if (demo.approval(); as approval) {
          <div class="approval" role="group" aria-label="Analyst approval">
            <p><b>Analyst approval needed.</b> {{ approval.text }}</p>
            <div class="row">
              <button type="button" class="approve" (click)="demo.approveNow()">Approve</button>
              <button type="button" (click)="demo.stop()">Stop demo</button>
              <span class="countdown">Demo: auto-approved as the demo analyst in {{ approval.secondsLeft }} s</span>
            </div>
          </div>
        }

        @if (!demo.running()) {
          <button type="button" class="again" (click)="demo.start()">Run the live demo again</button>
        }
      </aside>

      <div class="phone-slot">
        <sentinel-customer-phone />
      </div>
    }
  `,
  styles: `
    .console {
      position: fixed;
      z-index: 60;
      left: 20px;
      bottom: 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: min(460px, calc(100vw - 40px));
      max-height: min(420px, calc(100dvh - 120px));
      padding: 12px 14px;
      border: 1px solid var(--sentinel-color-accent);
      border-radius: 16px;
      background: color-mix(in srgb, var(--sentinel-color-surface) 96%, transparent);
      color: var(--sentinel-color-text);
      box-shadow: 0 18px 48px rgb(0 0 0 / 30%);
      backdrop-filter: blur(10px);
    }
    header {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-right: auto;
      font-size: 0.6875rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      color: var(--sentinel-color-accent-text, var(--sentinel-color-accent));
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--sentinel-color-text-secondary);
    }
    .dot.live {
      background: #ef4444;
      animation: blink 1s steps(2) infinite;
    }
    .icon {
      display: inline-grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: var(--sentinel-color-text-secondary);
      cursor: pointer;
    }
    .steps {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .steps li {
      padding: 2px 8px;
      border: 1px solid var(--sentinel-color-border);
      border-radius: 999px;
      color: var(--sentinel-color-text-secondary);
      font-size: 0.6875rem;
    }
    .steps li[data-state='done'] {
      border-color: transparent;
      background: color-mix(in srgb, var(--sentinel-color-success, #16a34a) 16%, transparent);
      color: var(--sentinel-color-text);
    }
    .steps li[data-state='now'] {
      border-color: var(--sentinel-color-accent);
      background: color-mix(in srgb, var(--sentinel-color-accent) 18%, transparent);
      color: var(--sentinel-color-text);
      font-weight: 700;
    }
    .log {
      display: grid;
      gap: 6px;
      min-height: 0;
      margin: 0;
      padding: 0 2px 0 0;
      overflow-y: auto;
      list-style: none;
    }
    .log li {
      display: grid;
      gap: 1px;
      padding: 6px 8px;
      border-left: 3px solid var(--sentinel-color-border);
      border-radius: 6px;
      background: color-mix(in srgb, var(--sentinel-color-background) 50%, transparent);
      font-size: 0.8125rem;
      line-height: 1.4;
      animation: enter 0.3s ease-out;
    }
    .log b {
      font-size: 0.6875rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .log li[data-speaker='RULES'] { border-left-color: #f59e0b; }
    .log li[data-speaker='GEMINI'] { border-left-color: #6366f1; }
    .log li[data-speaker='AGENT'] { border-left-color: var(--sentinel-color-accent); }
    .log li[data-speaker='ANALYST'] { border-left-color: #16a34a; }
    .log li[data-speaker='CUSTOMER'] { border-left-color: #ef4444; }
    .log li[data-speaker='BANK'] { border-left-color: #64748b; }
    .approval {
      display: grid;
      gap: 8px;
      padding: 10px;
      border: 2px solid #16a34a;
      border-radius: 12px;
      background: color-mix(in srgb, #16a34a 10%, var(--sentinel-color-surface));
    }
    .approval p {
      margin: 0;
      font-size: 0.8125rem;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .row button,
    .again {
      min-height: 32px;
      padding: 0 14px;
      border: 1px solid var(--sentinel-color-border);
      border-radius: 999px;
      background: var(--sentinel-color-surface);
      color: var(--sentinel-color-text);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }
    .row .approve {
      border-color: #16a34a;
      background: #16a34a;
      color: #fff;
    }
    .countdown {
      color: var(--sentinel-color-text-secondary);
      font-size: 0.75rem;
    }
    .again {
      align-self: flex-start;
      border-color: var(--sentinel-color-accent);
    }
    .phone-slot {
      position: fixed;
      z-index: 60;
      right: 20px;
      bottom: 20px;
      transform: scale(0.88);
      transform-origin: bottom right;
    }
    .banner {
      position: fixed;
      z-index: 70;
      top: 84px;
      left: 50%;
      padding: 12px 22px;
      border-radius: 999px;
      background: var(--sentinel-color-critical);
      color: #fff;
      font-size: 1.0625rem;
      font-weight: 800;
      box-shadow: 0 12px 30px rgb(0 0 0 / 30%);
      transform: translateX(-50%);
      animation: pop 0.4s ease-out;
    }
    @keyframes enter {
      from { opacity: 0; transform: translateY(6px); }
    }
    @keyframes pop {
      from { opacity: 0; transform: translate(-50%, -12px) scale(0.9); }
    }
    @keyframes blink {
      50% { opacity: 0.2; }
    }
    @media (prefers-reduced-motion: reduce) {
      .log li, .banner, .dot.live {
        animation: none;
      }
    }
    @media (max-width: 1400px) {
      .phone-slot {
        transform: scale(0.74);
        transform-origin: bottom right;
      }
    }
    @media (max-width: 760px) {
      .phone-slot {
        display: none;
      }
    }
  `,
})
export class LiveDemoNarrator {
  protected readonly demo = inject(LiveDemoAutopilot);
  protected readonly steps = LIVE_DEMO_STEPS;
  protected readonly speakers = SPEAKERS;
  protected readonly current = computed(() => {
    const step = this.demo.step();
    return step ? LIVE_DEMO_STEPS.findIndex((item) => item.step === step) : -1;
  });
  private readonly logList = viewChild<ElementRef<HTMLElement>>('log');

  constructor() {
    // The newest line stays in view.
    effect(() => {
      void this.demo.log();
      const list = this.logList()?.nativeElement;
      if (list) queueMicrotask(() => list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' }));
    });
  }
}
