import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'sentinel-trace-funds',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section aria-label="Trace funds"></section>`,
})
export class TraceFunds {}
