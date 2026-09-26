import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * The case summary: hypothesis, numbered evidence tied to real bundle values, recommended analyst actions.
 * Advisory only — every claim cites its sourceField, and it never recommends releasing a hold.
 */
@Component({
  selector: 'sentinel-gemini-advisory',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section aria-label="Gemini case summary"></section>`,
})
export class GeminiAdvisory {}
