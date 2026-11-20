import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Icon } from '../../../../shared/ui/icon/icon';
import { LiveDemoAutopilot } from '../../data-access/live-demo-autopilot';

/** The top-bar entries to the live demo and the multi-scam burst: one click runs the story on synthetic data. */
@Component({
  selector: 'sentinel-live-demo-button',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="live-demo" [attr.data-running]="demo.running() && demo.mode() === 'TAKEOVER'" [disabled]="demo.running()" (click)="demo.start()"
      title="Plays a synthetic account takeover end to end: stream, hold, investigation, customer outreach and kill switch">
      <sentinel-icon name="play" [size]="16" />
      <span>{{ demo.running() && demo.mode() === 'TAKEOVER' ? 'Live demo running…' : 'Live demo' }}</span>
    </button>
    <button type="button" class="live-demo burst" [attr.data-running]="demo.running() && demo.mode() === 'BURST'" [disabled]="demo.running()" (click)="demo.startBurst()"
      title="Plays four scam patterns on twelve synthetic accounts across three banks at once; the rules decide, seven agents work each case, the analyst approves">
      <sentinel-icon name="radar" [size]="16" />
      <span>{{ demo.running() && demo.mode() === 'BURST' ? 'Burst running…' : 'Multi-scam burst' }}</span>
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
      gap: 8px;
    }
    .live-demo.burst {
      background: color-mix(in srgb, var(--sentinel-color-accent) 14%, transparent);
      color: var(--sentinel-color-accent);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sentinel-color-accent) 55%, transparent);
    }
    .live-demo {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 36px;
      padding: 0 14px;
      border: 0;
      border-radius: 999px;
      background: var(--sentinel-color-accent);
      color: var(--sentinel-color-on-accent, #fff);
      font: inherit;
      font-weight: 700;
      white-space: nowrap;
      cursor: pointer;
      box-shadow: 0 4px 14px color-mix(in srgb, var(--sentinel-color-accent) 40%, transparent);
    }
    .live-demo:hover:not(:disabled) {
      filter: brightness(1.08);
    }
    .live-demo:focus-visible {
      outline: 2px solid var(--sentinel-color-accent);
      outline-offset: 3px;
    }
    .live-demo[data-running='true'] {
      opacity: 0.85;
      cursor: progress;
    }
    @media (max-width: 520px) {
      span {
        display: none;
      }
      .live-demo {
        padding: 0 10px;
      }
    }
  `,
})
export class LiveDemoButton {
  protected readonly demo = inject(LiveDemoAutopilot);
}
