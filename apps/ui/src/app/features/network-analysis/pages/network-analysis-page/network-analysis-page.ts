import { ChangeDetectionStrategy, Component } from '@angular/core';
import { EdgeInspector } from '../../components/edge-inspector/edge-inspector';
import { GraphCanvas } from '../../components/graph-canvas/graph-canvas';
import { NodeInspector } from '../../components/node-inspector/node-inspector';
import { ObservedBoundary } from '../../components/observed-boundary/observed-boundary';
import { TraceFunds } from '../../components/trace-funds/trace-funds';

/** Network analysis (M§5.5): COSMIC-inspired cross-institutional risk intelligence, demonstrated on synthetic, privacy-safe data. */
@Component({
  selector: 'sentinel-network-analysis-page',
  imports: [GraphCanvas, NodeInspector, EdgeInspector, TraceFunds, ObservedBoundary],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sentinel-graph-canvas />
    <sentinel-node-inspector />
    <sentinel-edge-inspector />
    <sentinel-trace-funds />
    <sentinel-observed-boundary />
  `,
})
export class NetworkAnalysisPage {}
