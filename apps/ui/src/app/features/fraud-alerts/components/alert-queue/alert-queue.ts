import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'sentinel-alert-queue',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section aria-label="Active alerts"></section>`,
})
export class AlertQueue {}
