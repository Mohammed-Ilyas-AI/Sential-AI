import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Rendered from the append-only intervention log, never reconstructed. */
@Component({
  selector: 'sentinel-case-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section aria-label="Case timeline"></section>`,
})
export class CaseTimeline {}
