import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'sentinel-case-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section aria-label="Case detail"></section>`,
})
export class CaseDetail {}
