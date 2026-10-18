import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { InstitutionLabelPipe } from '../../../../shared/pipes/institution-label/institution-label-pipe';
import { CasesFacade } from '../../data-access/cases-facade';

@Component({
  selector: 'sentinel-case-list',
  imports: [DatePipe, InstitutionLabelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="list surface" aria-labelledby="case-list-title">
      <h2 id="case-list-title">Case files <span>{{ facade.cases().length }}</span></h2>
      <ul>
        @for (investigationCase of facade.cases(); track investigationCase.id) {
          <li>
            <button type="button" [attr.aria-pressed]="facade.selectedCaseId() === investigationCase.id" (click)="facade.select(investigationCase.id)">
              <span class="top"><b>{{ investigationCase.accountReference ?? investigationCase.accountId }}</b><span class="status" [attr.data-status]="investigationCase.status">{{ investigationCase.status }}</span></span>
              <span>{{ investigationCase.institutionId | institutionLabel }} · {{ investigationCase.evidence.assessment.band }} · score {{ investigationCase.evidence.assessment.score }}</span>
              <small>{{ investigationCase.openedAt | date: 'd MMM y, HH:mm' : 'UTC' }} UTC</small>
            </button>
          </li>
        } @empty {
          <li class="empty">No case files have been opened.</li>
        }
      </ul>
    </section>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .list { padding: 16px; border: 1px solid var(--sentinel-surface-panel-border); border-radius: 12px; background: var(--sentinel-color-surface); }
    h2 { display: flex; justify-content: space-between; margin: 0 0 12px; font-size: 1rem; }
    h2 span, small { color: var(--sentinel-color-text-secondary); font-size: .75rem; font-weight: 500; }
    ul { display: grid; gap: 6px; max-height: 360px; margin: 0; padding: 0; overflow: auto; list-style: none; }
    button { display: grid; gap: 5px; width: 100%; padding: 11px; border: 1px solid transparent; border-radius: 8px; background: transparent; color: var(--sentinel-color-text); text-align: left; cursor: pointer; }
    button[aria-pressed='true'] { border-color: var(--sentinel-color-accent); background: color-mix(in srgb, var(--sentinel-color-accent) 9%, transparent); }
    .top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .status { font-size: .65rem; font-weight: 700; letter-spacing: .08em; }
    .empty { padding: 16px 8px; color: var(--sentinel-color-text-secondary); font-size: .85rem; }
  `],
})
export class CaseList {
  protected readonly facade = inject(CasesFacade);
}
