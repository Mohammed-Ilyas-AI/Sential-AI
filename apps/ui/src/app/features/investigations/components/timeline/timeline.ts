import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'sentinel-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section aria-label="Timeline"></section>`,
})
export class Timeline {}
