import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon } from '../icon/icon';
import type { IconName } from '../icon/icon-paths';

export type KpiTone = 'accent' | 'success' | 'warning' | 'critical' | 'muted' | 'violet';

/** A compact figure with a toned icon, for the summary row of a page. The value is passed in, never computed here. */
@Component({
  selector: 'sentinel-kpi-tile',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-tone]': 'tone()' },
  template: `
    <span class="icon"><sentinel-icon [name]="icon()" [size]="22" /></span>
    <span><span class="label">{{ label() }}</span><b>{{ value() }}</b></span>
  `,
  styles: `
    :host {
      --tone: var(--sentinel-color-accent);
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 11px 14px;
      border: 1px solid var(--sentinel-surface-panel-border);
      border-radius: 14px;
      background: color-mix(in srgb, var(--sentinel-color-surface) 92%, transparent);
      backdrop-filter: blur(6px);
    }
    :host([data-tone='success']) { --tone: var(--sentinel-color-success); }
    :host([data-tone='warning']) { --tone: var(--sentinel-color-warning); }
    :host([data-tone='critical']) { --tone: var(--sentinel-color-critical); }
    :host([data-tone='muted']) { --tone: var(--sentinel-color-text-secondary); }
    :host([data-tone='violet']) { --tone: #7c4ddb; }
    .icon {
      display: grid;
      flex: none;
      place-items: center;
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: color-mix(in srgb, var(--tone) 15%, transparent);
      color: var(--tone);
    }
    .label {
      display: block;
      color: var(--sentinel-color-text-secondary);
      font-size: 0.75rem;
    }
    b {
      font-family: var(--sentinel-font-family-mono);
      font-size: 1.5rem;
      line-height: 1.1;
    }
    @media (min-width: 1280px) and (max-height: 800px) {
      :host { padding: 8px 12px; }
    }
  `,
})
export class KpiTile {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly icon = input.required<IconName>();
  readonly tone = input<KpiTone>('accent');
}
