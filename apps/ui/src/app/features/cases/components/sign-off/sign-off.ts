import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Gemini drafts, the analyst signs off. The sign-off records the analyst identity. */
@Component({
  selector: 'sentinel-sign-off',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section aria-label="Sign-off"></section>`,
})
export class SignOff {}
