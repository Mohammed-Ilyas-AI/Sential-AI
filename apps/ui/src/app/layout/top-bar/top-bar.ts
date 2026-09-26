import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'sentinel-top-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header>
      <strong>SENTINEL AI</strong>
      <span>Detect. Explain. Intervene. Investigate.</span>
      <ng-content />
    </header>
  `,
  styles: `
    header {
      display: flex;
      align-items: baseline;
      gap: var(--sentinel-space-3);
      padding: var(--sentinel-space-3) var(--sentinel-space-4);
      border-bottom: 1px solid var(--sentinel-color-border);
    }
    span {
      color: var(--sentinel-color-text-muted);
      font-size: var(--sentinel-font-size-caption);
    }
  `,
})
export class TopBar {}
