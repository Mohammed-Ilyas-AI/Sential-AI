import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * The Singapore skyline artwork with its slogan, shown whole, for the navigation footers. The slogan is part of
 * the image (and its alt text), never repeated as HTML. A slow light sweep, a few twinkling network points and a
 * gentle float keep it alive; all motion stops under reduced motion.
 */
@Component({
  selector: 'sentinel-skyline-artwork',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="art">
      <img src="/dashboard/sidebar-singapore-artwork.webp" alt="Financial intelligence for a safer Singapore" width="520" height="414" decoding="async" />
      <span class="sparkles" aria-hidden="true"></span>
    </div>
  `,
  styles: `
    :host {
      display: grid;
      place-items: center;
    }
    .art {
      position: relative;
      width: 100%;
      height: var(--art-height, auto);
      overflow: hidden;
      border-radius: var(--art-radius, 12px);
      aspect-ratio: var(--art-ratio, 520 / 414);
    }
    img {
      display: block;
      width: 100%;
      height: 100%;
      mix-blend-mode: multiply;
      animation: skyline-float 7s ease-in-out infinite;
    }
    :host-context(:root:not([data-appearance='light'])) img {
      filter: invert(0.92) hue-rotate(180deg);
      mix-blend-mode: screen;
    }
    /* A soft band of light crossing the skyline. */
    .art::after {
      content: '';
      position: absolute;
      inset: 0 auto 0 0;
      width: 40%;
      background: linear-gradient(100deg, transparent 10%, rgba(80, 170, 255, 0.24), transparent 90%);
      mask-image: linear-gradient(transparent, #000 25%, #000 55%, transparent 80%);
      transform: translateX(-120%);
      animation: skyline-sweep 6.5s ease-in-out infinite;
      pointer-events: none;
    }
    /* Points on the network arcs that brighten in turn. */
    .sparkles {
      position: absolute;
      inset: 0 0 30% 0;
      background:
        radial-gradient(circle at 30% 30%, rgba(40, 190, 255, 0.95) 0 1.6px, transparent 2.6px),
        radial-gradient(circle at 52% 18%, rgba(40, 190, 255, 0.95) 0 1.6px, transparent 2.6px),
        radial-gradient(circle at 70% 26%, rgba(40, 190, 255, 0.95) 0 1.6px, transparent 2.6px);
      animation: skyline-twinkle 2.8s ease-in-out infinite;
      pointer-events: none;
    }
    .sparkles::after {
      content: '';
      position: absolute;
      inset: 0;
      background:
        radial-gradient(circle at 42% 40%, rgba(40, 190, 255, 0.95) 0 1.6px, transparent 2.6px),
        radial-gradient(circle at 63% 44%, rgba(40, 190, 255, 0.95) 0 1.6px, transparent 2.6px),
        radial-gradient(circle at 84% 34%, rgba(40, 190, 255, 0.95) 0 1.6px, transparent 2.6px);
      animation: skyline-twinkle 2.8s ease-in-out 1.4s infinite;
    }
    @keyframes skyline-float {
      50% {
        transform: translateY(-3px);
      }
    }
    @keyframes skyline-sweep {
      60%,
      100% {
        transform: translateX(260%);
      }
    }
    @keyframes skyline-twinkle {
      0%,
      100% {
        opacity: 0.15;
      }
      50% {
        opacity: 1;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      img,
      .art::after,
      .sparkles,
      .sparkles::after {
        animation: none;
      }
      .art::after {
        display: none;
      }
    }
  `,
})
export class SkylineArtwork {}
