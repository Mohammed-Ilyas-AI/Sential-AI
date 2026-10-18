import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import type { CaseReportSection } from '@sentinel/domain';
import { InstitutionLabelPipe } from '../../../../shared/pipes/institution-label/institution-label-pipe';
import { Icon } from '../../../../shared/ui/icon/icon';
import { CasesFacade } from '../../data-access/cases-facade';

/**
 * The selected case and its report: generated from the persisted evidence in one action, edited as a draft,
 * signed off after an explicit confirmation, exported as the PDF sentinel-core renders from the saved text.
 */
@Component({
  selector: 'sentinel-case-report',
  imports: [DatePipe, Icon, InstitutionLabelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './case-report.html',
  styleUrl: './case-report.css',
})
export class CaseReportPanel {
  protected readonly facade = inject(CasesFacade);
  protected readonly confirmingSignOff = signal(false);
  protected readonly isDraft = computed(() => this.facade.latest()?.status === 'DRAFT');

  protected bodyOf(section: CaseReportSection): string {
    return this.facade.edits()[section.id] ?? section.body;
  }

  protected onInput(section: CaseReportSection, event: Event): void {
    this.facade.edit(section.id, (event.target as HTMLTextAreaElement).value);
  }

  protected rows(section: CaseReportSection): number {
    return Math.min(16, Math.max(3, this.bodyOf(section).split('\n').length + 1));
  }

  protected requestSignOff(): void {
    this.confirmingSignOff.set(true);
  }

  protected confirmSignOff(): void {
    this.confirmingSignOff.set(false);
    this.facade.signOff();
  }
}
