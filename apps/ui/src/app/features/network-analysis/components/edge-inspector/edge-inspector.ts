import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Why an edge exists, from the record: reporting bank, network reference, observed time, linkage. */
@Component({
  selector: 'sentinel-edge-inspector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section aria-label="Edge provenance"></section>`,
})
export class EdgeInspector {}
