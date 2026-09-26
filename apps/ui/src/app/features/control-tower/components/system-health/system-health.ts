import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Stream connection state and Gemini availability; an AI outage never looks like a control outage. */
@Component({
  selector: 'sentinel-system-health',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section aria-label="System health"></section>`,
})
export class SystemHealth {}
