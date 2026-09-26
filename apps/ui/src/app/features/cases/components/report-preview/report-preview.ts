import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'sentinel-report-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section aria-label="Case report"></section>`,
})
export class ReportPreview {}
