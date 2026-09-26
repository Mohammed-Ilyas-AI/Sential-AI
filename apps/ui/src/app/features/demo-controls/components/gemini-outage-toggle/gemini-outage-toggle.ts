import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Demonstrates intelligence independence: with Gemini "down", decisions, holds and audit continue. */
@Component({
  selector: 'sentinel-gemini-outage-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section aria-label="Gemini outage simulation"></section>`,
})
export class GeminiOutageToggle {}
