import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeader } from '../../../../shared/ui/page-header/page-header';
import { EdgeInspector } from '../../components/edge-inspector/edge-inspector';
import { GraphCanvas } from '../../components/graph-canvas/graph-canvas';
import { NodeInspector } from '../../components/node-inspector/node-inspector';
import { ObservedBoundary } from '../../components/observed-boundary/observed-boundary';
import { TraceFunds } from '../../components/trace-funds/trace-funds';

/** Network analysis (M§5.5): COSMIC-inspired cross-institutional risk intelligence, demonstrated on synthetic, privacy-safe data. */
@Component({
  selector: 'sentinel-network-analysis-page',
  imports: [PageHeader, GraphCanvas, NodeInspector, EdgeInspector, TraceFunds, ObservedBoundary],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sentinel-page-header
      heading="Network analysis"
      summary="Cross-institutional relationships around a destination, two hops out, on synthetic data."
      status="Graph queries arrive with the intelligence path; flagged links already feed ENTITY_LINK scoring."
    />
    <sentinel-graph-canvas />
    <sentinel-node-inspector />
    <sentinel-edge-inspector />
    <sentinel-trace-funds />
    <sentinel-observed-boundary />
  `,
})
export class NetworkAnalysisPage {}
