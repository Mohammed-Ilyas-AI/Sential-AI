import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeader } from '../../../../shared/ui/page-header/page-header';
import { GraphCanvas } from '../../components/graph-canvas/graph-canvas';
import { NodeInspector } from '../../components/node-inspector/node-inspector';
import { ObservedBoundary } from '../../components/observed-boundary/observed-boundary';
import { TraceFunds } from '../../components/trace-funds/trace-funds';
import { NetworkAnalysisFacade } from '../../data-access/network-analysis-facade';

/** Network analysis (M§5.5): COSMIC-inspired cross-institutional risk intelligence, demonstrated on synthetic, privacy-safe data. */
@Component({
  selector: 'sentinel-network-analysis-page',
  imports: [PageHeader, RouterLink, GraphCanvas, NodeInspector, TraceFunds, ObservedBoundary],
  providers: [NetworkAnalysisFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sentinel-page-header
      heading="Network analysis"
      summary="Cross-institutional relationships around the account in focus, two hops out, exactly as the evidence bundle holds them."
    />
    @if (facade.decision(); as decision) {
      @switch (facade.status()) {
        @case ('LOADING') {
          <p class="sentinel-empty" role="status">Loading the neighbourhood…</p>
        }
        @case ('FAILED') {
          <p class="sentinel-empty" role="alert">sentinel-core could not compile the neighbourhood for this account.</p>
        }
        @case ('READY') {
          @if (facade.scene(); as scene) {
            <div class="layout">
              <section class="sentinel-panel sentinel-section graph" aria-labelledby="graph-title">
                <header>
                  <h2 id="graph-title">{{ decision.accountReference ?? decision.accountId }} · {{ scene.nodes.length }} entities, {{ scene.edges.length }} links</h2>
                  <span class="legend">
                    <span><i class="key account"></i>account</span><span><i class="key payee"></i>payee</span><span><i class="key device"></i>device</span>
                    <span><i class="key flagged"></i>flagged (!)</span><span><i class="key money"></i>money moved</span><span><i class="key weak"></i>may not score</span>
                  </span>
                </header>
                @if (scene.nodes.length <= 1) {
                  <p class="sentinel-empty">No linked entity is known for this account yet.</p>
                } @else {
                  <sentinel-graph-canvas [scene]="scene" [selectedId]="facade.selectedId()" (selected)="facade.select($event)" />
                }
              </section>
              <div class="side">
                <section class="sentinel-panel sentinel-section" aria-labelledby="inspector-title">
                  <header><h2 id="inspector-title">Entity</h2><span class="sentinel-muted">{{ facade.flaggedCount() }} flagged in view</span></header>
                  <sentinel-node-inspector [node]="facade.selectedNode()" [edges]="facade.selectedEdges()" />
                </section>
                <section class="sentinel-panel sentinel-section" aria-labelledby="trail-title">
                  <header><h2 id="trail-title">Money trail</h2></header>
                  <sentinel-trace-funds [steps]="facade.moneyTrail()" (selected)="facade.select($event)" />
                </section>
                <section class="sentinel-panel sentinel-section" aria-labelledby="boundary-title">
                  <header><h2 id="boundary-title">What this view can see</h2></header>
                  <sentinel-observed-boundary [truncated]="scene.truncated" />
                </section>
              </div>
            </div>
          }
        }
      }
    } @else {
      <p class="sentinel-empty">No account is in focus. Choose one in <a routerLink="/alerts">Alerts &amp; Cases</a>.</p>
    }
  `,
  styles: `
    .layout { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(300px, 1fr); gap: var(--sentinel-space-4); align-items: start; }
    @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } }
    .side { display: grid; gap: var(--sentinel-space-4); }
    .legend { display: flex; flex-wrap: wrap; gap: var(--sentinel-space-3); color: var(--sentinel-color-text-secondary); font-size: var(--sentinel-font-size-micro); }
    .legend span { display: inline-flex; align-items: center; gap: 6px; }
    .key { display: inline-block; width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--sentinel-color-border); }
    .key.account { border-color: var(--sentinel-color-series); }
    .key.payee { border-color: var(--sentinel-color-warning); }
    .key.device { border-color: var(--sentinel-color-info); }
    .key.flagged { border-color: var(--sentinel-color-hold); border-style: dashed; }
    .key.money { width: 18px; height: 0; border-radius: 0; border-width: 2px 0 0; border-color: var(--sentinel-color-series); }
    .key.weak { width: 18px; height: 0; border-radius: 0; border-width: 2px 0 0; border-style: dashed; }
  `,
})
export class NetworkAnalysisPage {
  protected readonly facade = inject(NetworkAnalysisFacade);
}
