import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import type { CaseReportSection, CaseReportSectionId } from '@sentinel/domain';
import { InstitutionLabelPipe } from '../../../../shared/pipes/institution-label/institution-label-pipe';
import { Icon } from '../../../../shared/ui/icon/icon';
import { CasesFacade } from '../../data-access/cases-facade';
import { CaseGlance } from '../case-glance/case-glance';
import { readReport, SECTION_LOOK, type ReportBlock } from './report-reading';

/**
 * The selected case and its report: generated from the persisted evidence in one action, edited as a draft,
 * signed off after an explicit confirmation, exported as the PDF sentinel-core renders from the saved text.
 */
@Component({
  selector: 'sentinel-case-report',
  imports: [DatePipe, Icon, InstitutionLabelPipe, CaseGlance],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './case-report.html',
  styleUrl: './case-report.css',
})
export class CaseReportPanel {
  protected readonly facade = inject(CasesFacade);
  protected readonly confirmingSignOff = signal(false);
  protected readonly isDraft = computed(() => this.facade.latest()?.status === 'DRAFT');
  protected readonly look = SECTION_LOOK;
  /** Sections the analyst has opened for editing; a section with unsaved edits stays open. */
  protected readonly editing = signal<ReadonlySet<CaseReportSectionId>>(new Set());

  protected isEditing(section: CaseReportSection): boolean {
    return this.isDraft() && (this.editing().has(section.id) || this.facade.edits()[section.id] !== undefined);
  }

  protected toggleEdit(section: CaseReportSection): void {
    this.editing.update((open) => {
      const next = new Set(open);
      if (next.has(section.id)) next.delete(section.id);
      else next.add(section.id);
      return next;
    });
  }

  protected blocks(section: CaseReportSection): readonly ReportBlock[] {
    return readReport(this.bodyOf(section));
  }

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
