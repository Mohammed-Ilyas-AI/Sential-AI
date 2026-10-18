import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Icon } from '../../../../shared/ui/icon/icon';
import { NetworkAnalysisFacade } from '../../data-access/network-analysis-facade';
import { institutionName } from '../../graph-engine/evidence-graph';

const REASON: Readonly<Record<string, string>> = {
  OUTSIDE_OBSERVED_NETWORK: 'the receiving bank contributed only its own leg',
  UNOBSERVED_LINK: 'the next link has no valid cross-bank linkage',
  CAPPED: 'the trace reached its node cap',
  CYCLE_DETECTED: 'the money returned to an account already on the path',
};

/** "Trace funds" (M§8.5): sentinel-core's observed path, and exactly where and why observation stops. */
@Component({
  selector: 'sentinel-trace-funds-control',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bar">
      <button type="button" aria-label="Trace funds" [disabled]="facade.status() !== 'READY' || facade.traceStatus() === 'LOADING'" (click)="facade.traceFunds()"
        title="Follows the observed outflow from the case account; with a destination selected, along that transfer">
        <sentinel-icon name="arrowDownRight" [size]="14" /> {{ facade.traceStatus() === 'LOADING' ? 'Tracing…' : 'Trace funds' }}
      </button>
      @if (facade.trace()) {
        <button type="button" class="clear" aria-label="Clear the fund trace" (click)="facade.clearTrace()"><sentinel-icon name="close" [size]="13" /></button>
      }
    </div>
    @if (statement(); as text) {
      <p role="status">{{ text }}</p>
    }
    @if (facade.traceStatus() === 'FAILED') {
      <p role="alert">The trace could not be loaded; the graph is unchanged.</p>
    }
    @if (facade.explorationStatus() === 'FAILED') {
      <p role="alert">The server network view is unavailable; showing the evidence bundle only.</p>
    }
  `,
  styles: `
    :host {
      position: absolute;
      top: 10px;
      right: 12px;
      z-index: 2;
      display: grid;
      justify-items: end;
      gap: 6px;
      max-width: min(360px, 70%);
    }
    .bar {
      display: flex;
      gap: 6px;
    }
    button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 30px;
      padding: 0 12px;
      border: 1px solid var(--sentinel-surface-panel-border);
      border-radius: 8px;
      background: var(--sentinel-color-surface);
      color: var(--sentinel-color-accent-text, var(--sentinel-color-accent));
      font: inherit;
      font-size: 0.75rem;
      font-weight: 700;
      cursor: pointer;
    }
    .clear {
      padding: 0 8px;
      color: var(--sentinel-color-text-secondary);
    }
    button:disabled {
      opacity: 0.5;
      cursor: default;
    }
    p {
      margin: 0;
      padding: 6px 10px;
      border: 1px solid var(--sentinel-surface-panel-border);
      border-radius: 8px;
      background: color-mix(in srgb, var(--sentinel-color-surface) 94%, transparent);
      font-size: 0.75rem;
      text-align: right;
    }
  `,
})
export class TraceFundsControl {
  protected readonly facade = inject(NetworkAnalysisFacade);

  protected readonly statement = computed(() => {
    const trace = this.facade.trace();
    if (!trace) return null;
    const { observedHops, complete, boundary, reason } = trace.observability;
    const hops = `Observed ${observedHops} hop${observedHops === 1 ? '' : 's'}.`;
    if (reason === 'NO_OUTFLOW_OBSERVED') return 'No settled outflow is observed from this account.';
    if (complete) return `${hops} The money remains inside the recording bank; nothing further is observed.`;
    const where = boundary ? ` beyond ${institutionName(boundary)}` : '';
    return `${hops} Downstream activity unavailable${where}: ${REASON[reason ?? ''] ?? 'observation stops here'}.`;
  });
}
