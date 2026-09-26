import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'sentinel-case-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section aria-label="Cases"></section>`,
})
export class CaseList {}
