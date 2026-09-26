import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Connected accounts, institutions involved, transaction count and risk indicators for the clicked node. */
@Component({
  selector: 'sentinel-node-inspector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section aria-label="Node details"></section>`,
})
export class NodeInspector {}
