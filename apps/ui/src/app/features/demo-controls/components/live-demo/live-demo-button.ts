import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Icon } from '../../../../shared/ui/icon/icon';
import { LiveDemoAutopilot } from '../../data-access/live-demo-autopilot';

/** The top-bar entry to the live demo: one click runs the whole story on synthetic data. */
@Component({
  selector: 'sentinel-live-demo-button',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="live-demo" [attr.data-running]="demo.running()" [disabled]="demo.running()" (click)="demo.start()"
      title="Plays a synthetic account takeover end to end: stream, hold, investigation, customer outreach and kill switch">
      <sentinel-icon name="play" [size]="16" />
      <span>{{ demo.running() ? 'Live demo running…' : 'Live demo' }}</span>
    </button>
  `,
  styles: `
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
