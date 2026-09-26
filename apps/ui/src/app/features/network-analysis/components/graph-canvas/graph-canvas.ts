import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Hosts a GraphRenderer. One control only: hop depth 1 or 2. No zoom-to-fit, no physics sliders, no minimap. */
@Component({
  selector: 'sentinel-graph-canvas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section aria-label="Entity graph"></section>`,
})
export class GraphCanvas {}
