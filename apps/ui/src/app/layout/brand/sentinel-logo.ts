import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The approved SENTINEL AI mark (public/brand/sentinel-mark.png, taken from the approved Control Tower reference)
 * with the wordmark set as live text so it stays crisp at any density.
 */
@Component({
  selector: 'sentinel-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <img class="mark" src="brand/sentinel-mark.png" alt="" width="38" height="41" />
    @if (showWordmark()) {
      <span class="wordmark">
        <span class="name">SENTINEL <span class="ai">AI</span></span>
        <span class="tagline">Secure tomorrow, today</span>
      </span>
    }
    <span class="sentinel-visually-hidden">SENTINEL AI</span>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }
    .mark {
      width: 34px;
      height: auto;
      flex: none;
      filter: drop-shadow(0 4px 16px color-mix(in srgb, var(--sentinel-brand-platform) 35%, transparent));
    }
    .wordmark {
      display: flex;
      flex-direction: column;
      min-width: 0;
      white-space: nowrap;
    }
    .name {
      font-family: var(--sentinel-font-family-brand);
      font-weight: 700;
      font-size: 1.1875rem;
      letter-spacing: 0.12em;
      line-height: 1.05;
    }
    .ai {
      color: var(--sentinel-brand-platform);
    }
    .tagline {
      margin-top: 4px;
      font-size: 0.625rem;
      font-weight: 500;
      letter-spacing: 0.14em;
      color: var(--sentinel-color-text-secondary);
      text-transform: uppercase;
    }
    @media (max-width: 420px) {
      .tagline {
        display: none;
      }
    }
  `,
})
export class SentinelLogo {
  readonly showWordmark = input(true);
}
