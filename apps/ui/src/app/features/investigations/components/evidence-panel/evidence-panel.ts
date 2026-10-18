import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { EvidenceBundle } from '@sentinel/domain';
import { Icon } from '../../../../shared/ui/icon/icon';
import type { IconName } from '../../../../shared/ui/icon/icon-paths';

/**
 * The evidence bundle exactly as sentinel-core compiled it: counts first, then the same object Gemini receives,
 * capped, on request. Compiled before any model call; the model only ever sees this.
 */
@Component({
  selector: 'sentinel-evidence-panel',
  imports: [JsonPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card" aria-labelledby="bundle-title">
      <div class="row">
        <h2 id="bundle-title">Evidence bundle<span>for this investigation</span></h2>
        <ul class="counts">
          @for (count of counts(); track count.label) {
            <li [attr.data-tone]="count.tone">
              <span class="tile" aria-hidden="true"><sentinel-icon [name]="count.icon" [size]="20" /></span>
              <span class="text">
                <b class="sentinel-figures">{{ count.value }}</b>
                <span>{{ count.label }}</span>
              </span>
            </li>
          }
        </ul>
        <button type="button" class="view" [attr.aria-expanded]="open()" aria-controls="bundle-object" (click)="open.set(!open())">
          <sentinel-icon name="audit" [size]="18" />
          {{ open() ? 'Hide evidence' : 'View evidence' }}
        </button>
      </div>
      @if (evidence().neighbourhood.truncated) {
        <p class="note">The graph neighbourhood was capped at 40 nodes; the least significant edges were dropped.</p>
      }
      @if (open()) {
        <div id="bundle-object">
          <p class="note">The object sent to Gemini, exactly as compiled.</p>
          <pre class="sentinel-mono sentinel-scroll">{{ evidence() | json }}</pre>
        </div>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
    }
    .card {
      padding: var(--sentinel-space-3) var(--sentinel-space-4);
      border: 1px solid var(--sentinel-surface-panel-border);
      border-radius: var(--sentinel-radius-large);
      background: var(--sentinel-surface-card);
      box-shadow: var(--sentinel-elevation-panel);
      min-width: 0;
    }
    h2 {
      display: grid;
      flex: none;
      margin: 0;
      font-size: var(--sentinel-font-size-body);
      font-weight: 600;
    }
    .row {
      display: flex;
      align-items: center;
      gap: var(--sentinel-space-3);
    }
    h2 span {
      color: var(--sentinel-color-text-muted);
      font-size: var(--sentinel-font-size-micro);
      font-weight: 400;
    }
    .counts {
      flex: 1;
      min-width: 0;
      list-style: none;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: var(--sentinel-space-2);
      margin: 0;
      padding: 0;
    }
    .counts li {
      --tone: var(--sentinel-color-info);
      display: flex;
      align-items: center;
      gap: var(--sentinel-space-2);
      padding: 6px var(--sentinel-space-2);
      border: 1px solid var(--sentinel-color-border-soft);
      border-radius: var(--sentinel-radius-medium);
      background: color-mix(in srgb, var(--sentinel-color-background) 50%, var(--sentinel-surface-card));
    }
    .counts li[data-tone='device'] { --tone: var(--sentinel-color-accent-tertiary, var(--sentinel-color-accent)); }
    .counts li[data-tone='payee'] { --tone: var(--sentinel-color-success); }
    .counts li[data-tone='alert'] { --tone: var(--sentinel-color-warning); }
    .counts li[data-tone='intervention'] { --tone: var(--sentinel-color-hold); }
    .counts li[data-tone='graph'] { --tone: var(--sentinel-color-accent); }
    .tile {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      flex: none;
      border-radius: var(--sentinel-radius-medium);
      background: color-mix(in srgb, var(--tone) 13%, transparent);
      color: var(--tone);
    }
    .text {
      display: grid;
      min-width: 0;
    }
    .text b {
      font-size: var(--sentinel-font-size-body);
      line-height: 1.2;
    }
    .text span {
      color: var(--sentinel-color-text-muted);
      font-size: var(--sentinel-font-size-micro);
      line-height: 1.25;
    }
    .view {
      display: inline-flex;
      align-items: center;
      gap: var(--sentinel-space-2);
      flex: none;
      min-height: 40px;
      padding: 0 var(--sentinel-space-4);
      border: 1px solid var(--sentinel-color-accent);
      border-radius: var(--sentinel-radius-medium);
      background: transparent;
      color: var(--sentinel-color-accent-text, var(--sentinel-color-accent));
      font: inherit;
      font-weight: 600;
      font-size: var(--sentinel-font-size-caption);
      cursor: pointer;
    }
    .view:hover {
      background: color-mix(in srgb, var(--sentinel-color-accent) 8%, transparent);
    }
    .note {
      margin: var(--sentinel-space-3) 0 0;
      color: var(--sentinel-color-text-muted);
      font-size: var(--sentinel-font-size-caption);
    }
    pre {
      max-height: 26vh;
      overflow: auto;
      margin: var(--sentinel-space-2) 0 0;
      padding: var(--sentinel-space-3);
      border-radius: var(--sentinel-radius-small);
      background: var(--sentinel-color-background);
      font-size: var(--sentinel-font-size-micro);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    @media (max-width: 1023px) {
      .row {
        flex-direction: column;
        align-items: stretch;
      }
    }
  `,
})
export class EvidencePanel {
  readonly evidence = input.required<EvidenceBundle>();
  protected readonly open = signal(false);

  protected readonly counts = computed(() => {
    const evidence = this.evidence();
    const counts: readonly { label: string; value: number; icon: IconName; tone: string }[] = [
      { label: 'Recent transactions (cap 50)', value: evidence.recentTransactions.length, icon: 'transfer', tone: 'transaction' },
      { label: 'Device events', value: evidence.deviceHistory.length, icon: 'server', tone: 'device' },
      { label: 'Payees added', value: evidence.payeeHistory.length, icon: 'account', tone: 'payee' },
      { label: 'Prior alerts', value: evidence.priorAlerts.length, icon: 'alert', tone: 'alert' },
      { label: 'Intervention records', value: evidence.interventions.length, icon: 'intervention', tone: 'intervention' },
      { label: 'Graph nodes (cap 40)', value: evidence.neighbourhood.nodes.length, icon: 'network', tone: 'graph' },
    ];
    return counts;
  });
}
