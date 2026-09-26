import { ChangeDetectionStrategy, Component } from '@angular/core';

/** States where observation stops instead of implying omniscience. We never invent a hop. */
@Component({
  selector: 'sentinel-observed-boundary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section aria-label="Observed boundary"></section>`,
})
export class ObservedBoundary {}
