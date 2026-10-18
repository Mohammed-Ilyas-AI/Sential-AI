import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../../../shared/ui/icon/icon';
import type { IconName } from '../../../../shared/ui/icon/icon-paths';
import type { SystemStatusRow } from '../../models/operations-overview';

const ROW_ICON: Readonly<Record<string, IconName>> = {
  ingestion: 'activity',
  rules: 'policy',
  policy: 'lock',
  ai: 'explain',
  websocket: 'server',
};

/**
 * Control-path health as the browser can see it. The AI row is advisory and never in the decision path, so its
 * absence never makes the control path look degraded.
 */
@Component({
  selector: 'sentinel-system-status',
  imports: [Icon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header>
      <h2>System Status</h2>
      <span class="overall" [attr.data-state]="overall()"><span class="dot" aria-hidden="true"></span>{{ overallLabel() }}</span>
      <a class="more" routerLink="/integrations"><sentinel-icon name="chevronRight" [size]="16" label="Open integrations" /></a>
    </header>
    <ul>
      @for (row of rows(); track row.id) {
        <li [attr.data-state]="row.state">
          <sentinel-icon [name]="icon[row.id] ?? 'server'" [size]="16" />
          <span class="label">{{ row.label }}</span>
          <span class="value sentinel-mono">{{ row.value }}</span>
        </li>
      }
    </ul>
  `,
  styles: `
    :host {
      display: block;
      padding: 12px 16px;
    }
    header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding-bottom: 8px;
      margin-bottom: 6px;
      border-bottom: 1px solid var(--sentinel-color-border-soft);
    }
    h2 {
      margin: 0;
      font-size: 0.9375rem;
      font-weight: 600;
      white-space: nowrap;
    }
    .overall {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 1;
      min-width: 0;
      padding-left: 10px;
      border-left: 1px solid var(--sentinel-color-border-soft);
      color: var(--sentinel-color-success);
      font-size: 0.75rem;
      white-space: nowrap;
      overflow: hidden;
    }
    .overall[data-state='degraded'] {
      color: var(--sentinel-color-warning);
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
      box-shadow: 0 0 8px currentColor;
    }
    .more {
      display: grid;
      place-items: center;
      width: 26px;
      height: 26px;
      border: 1px solid var(--sentinel-color-border-soft);
      border-radius: 6px;
      color: var(--sentinel-color-text-secondary);
    }
    ul {
      list-style: none;
      display: grid;
      gap: 3px;
      margin: 0;
      padding: 0;
      font-size: 0.8125rem;
    }
    li {
      display: grid;
      grid-template-columns: 18px minmax(0, 1fr) auto;
      align-items: center;
      gap: 8px;
      color: var(--sentinel-color-text-secondary);
    }
    li sentinel-icon {
      color: var(--sentinel-color-success);
    }
    li[data-state='degraded'] sentinel-icon {
      color: var(--sentinel-color-warning);
    }
    li[data-state='offline'] sentinel-icon {
      color: var(--sentinel-color-text-muted);
    }
    .label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .value {
      font-size: 0.75rem;
      color: var(--sentinel-color-text);
    }
    li[data-state='offline'] .value {
      color: var(--sentinel-color-text-muted);
    }
    @media (min-width: 768px) and (max-height: 800px) {
      :host {
        padding: 8px 14px;
      }
      header {
        padding-bottom: 6px;
        margin-bottom: 4px;
      }
      ul {
        gap: 1px;
        font-size: 0.75rem;
      }
    }
  `,
})
export class SystemStatus {
  readonly rows = input.required<readonly SystemStatusRow[]>();
  protected readonly icon = ROW_ICON;

  /** The control path is what the analyst depends on; the advisory AI row is excluded from the overall state. */
  protected readonly overall = computed(() =>
    this.rows().some((row) => row.id !== 'ai' && row.state !== 'operational') ? 'degraded' : 'operational',
  );
  protected readonly overallLabel = computed(() => (this.overall() === 'operational' ? 'Control path operational' : 'Reconnecting'));
}
