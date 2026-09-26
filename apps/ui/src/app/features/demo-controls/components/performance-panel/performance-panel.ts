import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Behind a key combination: live event rate, main-thread time per batch, message-to-row latency. */
@Component({
  selector: 'sentinel-performance-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section aria-label="Performance"></section>`,
})
export class PerformancePanel {}
