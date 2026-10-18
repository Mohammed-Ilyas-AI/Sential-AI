import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, output, type OnDestroy, type OnInit } from '@angular/core';
import { UI_PERFORMANCE_TARGETS } from '../../../../core/telemetry/performance-metrics';
import { Icon } from '../../../../shared/ui/icon/icon';
import { DemoControlsFacade } from '../../data-access/demo-controls-facade';

/**
 * Behind Ctrl+Shift+P (T§5): live event rate, main-thread time per batch, message-to-row latency and render
 * passes in this browser, plus sentinel-core's measured request latency. Measured, not asserted: an empty window
 * says "no samples", never zero.
 */
@Component({
  selector: 'sentinel-performance-panel',
  imports: [DatePipe, DecimalPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header>
      <h2><sentinel-icon name="activity" [size]="16" /> Performance</h2>
      <button type="button" aria-label="Close the performance panel" (click)="closed.emit()"><sentinel-icon name="close" [size]="14" /></button>
    </header>
    @if (facade.ui(); as ui) {
      <h3>This browser · last {{ ui.windowSeconds }} s</h3>
      <dl>
        <div [attr.data-ok]="ui.eventsPerSecond > 0 ? ui.eventsPerSecond <= targets.eventsPerSecond : null">
          <dt>Decisions received</dt><dd>{{ ui.eventsPerSecond | number: '1.0-1' }}/s <small>sustains {{ targets.eventsPerSecond }}/s</small></dd>
        </div>
        <div [attr.data-ok]="ui.mainThreadMsPerBatch.p95 === null ? null : ui.mainThreadMsPerBatch.p95 < targets.mainThreadMsPerBatch">
          <dt>Main thread per batch</dt>
          <dd>{{ ui.mainThreadMsPerBatch.p95 === null ? 'no samples' : 'p95 ' + (ui.mainThreadMsPerBatch.p95 | number: '1.1-1') + ' ms' }} <small>&lt; {{ targets.mainThreadMsPerBatch }} ms · {{ ui.mainThreadMsPerBatch.samples }} batches</small></dd>
        </div>
        <div [attr.data-ok]="ui.messageToRowMs.p95 === null ? null : ui.messageToRowMs.p95 < targets.messageToRowMs">
          <dt>Message to row</dt>
          <dd>{{ ui.messageToRowMs.p95 === null ? 'no samples' : 'p95 ' + (ui.messageToRowMs.p95 | number: '1.0-0') + ' ms' }} <small>&lt; {{ targets.messageToRowMs }} ms</small></dd>
        </div>
        <div [attr.data-ok]="ui.changeDetectionPassesPerSecond <= targets.changeDetectionPassesPerSecond">
          <dt>Render passes</dt><dd>{{ ui.changeDetectionPassesPerSecond | number: '1.0-1' }}/s <small>≤ {{ targets.changeDetectionPassesPerSecond }}/s target</small></dd>
        </div>
      </dl>
    }
    <h3>sentinel-core · this instance</h3>
    @switch (facade.serverStatus()) {
      @case ('IDLE') {
        <p class="muted">Loading…</p>
      }
      @case ('UNAVAILABLE') {
        <p class="muted">Unavailable: sentinel-core did not answer.</p>
      }
      @default {
        @if (facade.server(); as server) {
          <dl>
            @for (path of server.paths; track path.path) {
              <div [attr.data-ok]="path.budget && path.latency.p95Ms !== null ? path.latency.p95Ms <= path.budget.targetMs : null">
                <dt>{{ path.path }}</dt>
                <dd>
                  @if (path.latency.p95Ms === null) {
                    no samples
                  } @else {
                    p50 {{ path.latency.p50Ms | number: '1.0-0' }} · p95 {{ path.latency.p95Ms | number: '1.0-0' }} ms
                  }
                  <small>{{ path.requests }} req · {{ path.failures }} failed{{ path.budget ? ' · target ' + path.budget.targetMs + ' ms' : '' }}</small>
                </dd>
              </div>
            }
          </dl>
          <p class="muted">Window {{ server.windowSeconds / 60 }} min · captured {{ server.capturedAt | date: 'HH:mm:ss' : 'UTC' }} UTC · per instance</p>
        }
      }
    }
  `,
  styleUrl: './performance-panel.css',
})
export class PerformancePanel implements OnInit, OnDestroy {
  readonly closed = output<void>();
  protected readonly facade = inject(DemoControlsFacade);
  protected readonly targets = UI_PERFORMANCE_TARGETS;

  ngOnInit(): void {
    this.facade.startPanel();
  }

  ngOnDestroy(): void {
    this.facade.stopPanel();
  }
}
