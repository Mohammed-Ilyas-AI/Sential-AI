import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, signal } from '@angular/core';
import { Icon } from '../../../../shared/ui/icon/icon';

/** What the server does with every advisory request; shown as facts about the pipeline, not as fake progress. */
const NOTES = [
  'The rules engine has already decided. Gemini only explains that decision.',
  'Gemini reads the evidence bundle exactly as sentinel-core compiled it.',
  'Every claim must cite a field that exists in the bundle, or it is removed.',
  'An answer that recommends releasing a hold is rejected outright.',
] as const;
const NOTE_INTERVAL_MS = 3_500;

/**
 * Gemini at work: an orbiting mark, a shimmer in the shape of the answer and the real elapsed time. Purely
 * presentational; it never claims a step that has not happened. Still under reduced motion.
 */
@Component({
  selector: 'sentinel-advisory-loader',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="loader" role="status" aria-live="polite">
      <div class="orb" aria-hidden="true">
        <span class="ring one"></span>
        <span class="ring two"></span>
        <span class="ring three"></span>
        <span class="core"><sentinel-icon name="explain" [size]="30" /></span>
        <span class="spark a"></span>
        <span class="spark b"></span>
        <span class="spark c"></span>
      </div>
      <p class="title">{{ label() }}</p>
      <p class="elapsed sentinel-figures">{{ elapsed() }} s elapsed · higher reasoning can take up to a minute</p>
      <div class="shimmer" aria-hidden="true">
        <span style="width: 92%"></span>
        <span style="width: 78%"></span>
        <span style="width: 86%"></span>
        <span style="width: 54%"></span>
      </div>
      <p class="note">{{ note() }}</p>
    </div>
  `,
  styles: `
    :host {
      display: block;
      --ai: var(--sentinel-color-accent-tertiary, var(--sentinel-color-accent));
    }
    .loader {
      display: grid;
      justify-items: center;
      gap: var(--sentinel-space-3);
      padding: var(--sentinel-space-6) var(--sentinel-space-4) var(--sentinel-space-4);
      text-align: center;
    }
    .orb {
      position: relative;
      width: 132px;
      height: 132px;
      margin-bottom: var(--sentinel-space-2);
    }
    .ring {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 2px solid transparent;
    }
    .ring.one {
      border-top-color: var(--ai);
      border-right-color: color-mix(in srgb, var(--ai) 40%, transparent);
      animation: spin 1.6s linear infinite;
    }
    .ring.two {
      inset: 14px;
      border-bottom-color: var(--sentinel-color-accent);
      border-left-color: color-mix(in srgb, var(--sentinel-color-accent) 40%, transparent);
      animation: spin 2.4s linear infinite reverse;
    }
    .ring.three {
      inset: 28px;
      border: 1px dashed color-mix(in srgb, var(--ai) 45%, transparent);
      animation: spin 9s linear infinite;
    }
    .core {
      position: absolute;
      inset: 40px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--ai) 30%, #fff), var(--ai) 70%);
      color: #fff;
      box-shadow:
        0 0 0 6px color-mix(in srgb, var(--ai) 14%, transparent),
        0 10px 30px color-mix(in srgb, var(--ai) 45%, transparent);
      animation: pulse 2s ease-in-out infinite;
    }
    .spark {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 8px;
      height: 8px;
      margin: -4px;
      border-radius: 50%;
      background: var(--sentinel-color-accent);
      box-shadow: 0 0 10px var(--sentinel-color-accent);
    }
    .spark.a { animation: orbit 2.2s linear infinite; }
    .spark.b { animation: orbit 3.1s linear infinite reverse; background: var(--ai); box-shadow: 0 0 10px var(--ai); }
    .spark.c { animation: orbit 4s linear infinite; width: 5px; height: 5px; margin: -2.5px; }
    .title {
      margin: 0;
      font-size: var(--sentinel-font-size-title);
      font-weight: 600;
      background: linear-gradient(90deg, var(--sentinel-color-text), var(--ai), var(--sentinel-color-text));
      background-size: 200% 100%;
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      animation: sheen 2.6s linear infinite;
    }
    .elapsed,
    .note {
      margin: 0;
      color: var(--sentinel-color-text-muted);
      font-size: var(--sentinel-font-size-caption);
    }
    .note {
      max-width: 440px;
      min-height: 2.6em;
    }
    .shimmer {
      display: grid;
      gap: 10px;
      width: min(520px, 100%);
      margin: var(--sentinel-space-2) 0;
      justify-items: start;
    }
    .shimmer span {
      height: 12px;
      border-radius: var(--sentinel-radius-pill);
      background: linear-gradient(
        90deg,
        color-mix(in srgb, var(--ai) 10%, transparent) 0%,
        color-mix(in srgb, var(--ai) 28%, transparent) 50%,
        color-mix(in srgb, var(--ai) 10%, transparent) 100%
      );
      background-size: 200% 100%;
      animation: sheen 1.6s ease-in-out infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes orbit {
      from { transform: rotate(0deg) translateX(62px); }
      to { transform: rotate(360deg) translateX(62px); }
    }
    @keyframes pulse {
      50% { transform: scale(1.06); }
    }
    @keyframes sheen {
      from { background-position: 200% 0; }
      to { background-position: -200% 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .ring, .core, .spark, .title, .shimmer span {
        animation: none;
      }
      .spark { display: none; }
    }
  `,
})
export class AdvisoryLoader {
  readonly label = input('Gemini is reasoning over the evidence bundle…');

  protected readonly elapsed = signal(0);
  protected readonly note = signal<string>(NOTES[0]);

  constructor() {
    const started = Date.now();
    let index = 0;
    const tick = setInterval(() => this.elapsed.set(Math.floor((Date.now() - started) / 1000)), 1000);
    const rotate = setInterval(() => this.note.set(NOTES[(index = (index + 1) % NOTES.length)] ?? NOTES[0]), NOTE_INTERVAL_MS);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(tick);
      clearInterval(rotate);
    });
  }
}
