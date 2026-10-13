import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Workspace title, one-line purpose and, while a workspace is still being built, an honest status line. */
@Component({
  selector: 'sentinel-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>{{ heading() }}</h1>
    <p class="summary">{{ summary() }}</p>
    @if (status(); as status) {
      <p class="status"><span class="dot" aria-hidden="true"></span>{{ status }}</p>
    }
    <ng-content />
  `,
  styles: `
    :host {
      display: block;
      margin-bottom: var(--sentinel-space-6);
      animation: sentinel-enter var(--sentinel-motion-duration-slow) var(--sentinel-motion-easing-standard);
    }
    h1 {
      margin: 0;
      font-size: var(--sentinel-font-size-headline);
      font-weight: 600;
      letter-spacing: -0.02em;
    }
    .summary {
      margin: var(--sentinel-space-1) 0 0;
      color: var(--sentinel-color-text-secondary);
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: var(--sentinel-space-2);
      margin: var(--sentinel-space-3) 0 0;
      padding: 4px 12px;
      border: 1px solid var(--sentinel-color-border-soft);
      border-radius: var(--sentinel-radius-pill);
      background: var(--sentinel-color-surface);
      color: var(--sentinel-color-text-secondary);
      font-size: var(--sentinel-font-size-caption);
    }
    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--sentinel-color-warning);
    }
  `,
})
export class PageHeader {
  readonly heading = input.required<string>();
  readonly summary = input.required<string>();
  readonly status = input<string | null>(null);
}
