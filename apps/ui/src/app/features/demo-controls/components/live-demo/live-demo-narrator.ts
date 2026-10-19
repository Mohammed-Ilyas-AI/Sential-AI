import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Icon } from '../../../../shared/ui/icon/icon';
import { LIVE_DEMO_STEPS, LiveDemoAutopilot } from '../../data-access/live-demo-autopilot';

/** The live demo's caption card: where the story is, what just happened, and a way to stop it. */
@Component({
  selector: 'sentinel-live-demo-narrator',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (demo.visible()) {
      <aside class="narrator" role="status" aria-live="polite" aria-label="Live demo">
        <header>
          <span class="tag">LIVE DEMO · synthetic data</span>
          <button type="button" class="close" (click)="demo.stop()" [attr.aria-label]="demo.running() ? 'Stop the live demo' : 'Close the live demo'">
            <sentinel-icon name="close" [size]="16" />
          </button>
        </header>
        <ol class="steps">
          @for (item of steps; track item.step; let index = $index) {
            <li [attr.data-state]="index < current() ? 'done' : index === current() ? 'now' : 'next'">{{ item.label }}</li>
          }
        </ol>
        @if (demo.failure(); as failure) {
          <p class="failure">{{ failure }}</p>
        } @else {
          <p class="line">{{ demo.narration() }}</p>
        }
        @if (!demo.running()) {
          <button type="button" class="again" (click)="demo.start()">Run again</button>
        }
      </aside>
    }
  `,
  styles: `
    .narrator {
      position: fixed;
      z-index: 60;
      left: 50%;
      bottom: 20px;
      transform: translateX(-50%);
      display: grid;
      gap: 10px;
      width: min(760px, calc(100vw - 32px));
      padding: 14px 16px;
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
      justify-content: space-between;
    }
    .tag {
      font-size: 0.6875rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: var(--sentinel-color-accent-text, var(--sentinel-color-accent));
    }
    .close {
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
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .steps li {
      padding: 3px 10px;
      border-radius: 999px;
      border: 1px solid var(--sentinel-color-border);
      color: var(--sentinel-color-text-secondary);
      font-size: 0.75rem;
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
    .line,
    .failure {
      margin: 0;
      font-size: 0.9375rem;
      line-height: 1.45;
    }
    .failure {
      color: var(--sentinel-color-critical);
    }
    .again {
      justify-self: start;
      min-height: 32px;
      padding: 0 14px;
      border: 1px solid var(--sentinel-color-accent);
      border-radius: 999px;
      background: transparent;
      color: var(--sentinel-color-text);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }
  `,
})
export class LiveDemoNarrator {
  protected readonly demo = inject(LiveDemoAutopilot);
  protected readonly steps = LIVE_DEMO_STEPS;
  protected readonly current = computed(() => {
    const step = this.demo.step();
    return step ? LIVE_DEMO_STEPS.findIndex((item) => item.step === step) : -1;
  });
}
