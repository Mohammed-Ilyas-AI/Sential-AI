import { ChangeDetectionStrategy, Component } from '@angular/core';

/** The evidence bundle as it assembles: the same object Gemini receives. */
@Component({
  selector: 'sentinel-evidence-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section aria-label="Evidence"></section>`,
})
export class EvidencePanel {}
