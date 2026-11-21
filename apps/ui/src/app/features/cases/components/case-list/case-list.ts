import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { InstitutionLabelPipe } from '../../../../shared/pipes/institution-label/institution-label-pipe';
import { Icon } from '../../../../shared/ui/icon/icon';
import { CasesFacade } from '../../data-access/cases-facade';

/** The case files and the alerts that can still be opened as one. */
@Component({
  selector: 'sentinel-case-list',
  imports: [DatePipe, Icon, InstitutionLabelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header>
      <h2>Case files <span class="count">{{ facade.cases().length }}</span></h2>
      <button type="button" class="ghost" [disabled]="facade.listStatus() === 'LOADING'" (click)="facade.refresh()">
        <sentinel-icon name="activity" [size]="14" /> Refresh
      </button>
    </header>

    <div class="rows sentinel-scroll" role="listbox" aria-label="Cases">
      @switch (facade.listStatus()) {
        @case ('LOADING') {
          <p class="empty">Loading cases…</p>
        }
        @case ('ERROR') {
          <p class="empty error">{{ facade.listError() }}</p>
        }
        @default {
          @for (item of facade.cases(); track item.id) {
            <button type="button" role="option" class="row" [attr.data-band]="item.evidence.assessment.band" [attr.aria-selected]="facade.selectedId() === item.id" (click)="facade.select(item.id)">
              <span class="top">
                <span class="who"><span class="score">{{ item.evidence.assessment.score }}</span><b>{{ item.accountReference ?? item.accountId }}</b></span>
                <span class="status" [attr.data-status]="item.status">{{ item.status.replace('_', ' ') }}</span>
              </span>
              <span class="meta">
                {{ item.institutionId | institutionLabel }} · score {{ item.evidence.assessment.score }} ({{ item.evidence.assessment.band }})
              </span>
              <span class="meta">Opened {{ item.openedAt | date: 'd MMM, HH:mm' : 'UTC' }} UTC by {{ item.openedBy }}</span>
            </button>
          } @empty {
            <p class="empty">No case yet. In Alerts &amp; Cases, select an alert and choose <b>Open case file</b>.</p>
          }
        }
      }
    </div>
  `,
  styleUrl: './case-list.css',
})
export class CaseList {
  protected readonly facade = inject(CasesFacade);
}
