import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The SENTINEL AI logo (public/brand): the full lockup — shield mark, wordmark and "Secure tomorrow, today" — or
 * the shield mark alone where space is tight. Transparent artwork, readable on the dark and light themes alike.
 * It is the platform identity: no bank lens or theme ever replaces it.
 */
@Component({
  selector: 'sentinel-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (showWordmark()) {
      <img class="logo" src="brand/sentinel-logo.webp" alt="SENTINEL AI — Secure tomorrow, today" width="330" height="112" />
    } @else {
      <img class="mark" src="brand/sentinel-logo-mark.webp" alt="SENTINEL AI" width="98" height="112" />
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      min-width: 0;
    }
    img {
      display: block;
      width: auto;
      height: 58px;
      flex: none;
      filter: drop-shadow(0 4px 14px color-mix(in srgb, var(--sentinel-brand-platform) 28%, transparent));
    }
    /* The glow belongs to the dark room; on light surfaces it only blurs the lettering. */
    :host-context([data-appearance='light']) img {
      filter: none;
    }
    @media (max-width: 420px) {
      img {
        height: 44px;
      }
    }
  `,
})
export class SentinelLogo {
  readonly showWordmark = input(true);
}
