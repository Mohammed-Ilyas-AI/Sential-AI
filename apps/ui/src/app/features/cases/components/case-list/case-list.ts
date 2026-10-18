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
      <h2>Case files</h2>
      <button type="button" class="ghost" [disabled]="facade.listStatus() === 'LOADING'" (click)="facade.refresh()">
        <sentinel-icon name="activity" [size]="14" /> Refresh
      </button>
    </header>

    @if (facade.openable().length) {
      <label class="open">
        <span>Investigate an open alert</span>
        <select #alert aria-label="Open alert to investigate">
          @for (option of facade.openable(); track option.id) {
            <option [value]="option.id">{{ option.accountReference ?? option.accountId }} · score {{ option.score }} · raised {{ option.raisedAt | date: 'd MMM, HH:mm:ss' : 'UTC' }} UTC</option>
          }
        </select>
        <button type="button" class="primary" [disabled]="facade.busy() !== null" (click)="facade.openCase(alert.value)">
          {{ facade.busy() === 'OPEN' ? 'Opening…' : 'Open case' }}
        </button>
      </label>
    }

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
            <button type="button" role="option" class="row" [attr.aria-selected]="facade.selectedId() === item.id" (click)="facade.select(item.id)">
              <span class="top">
                <b>{{ item.accountReference ?? item.accountId }}</b>
                <span class="status" [attr.data-status]="item.status">{{ item.status.replace('_', ' ') }}</span>
              </span>
              <span class="meta">
                {{ item.institutionId | institutionLabel }} · score {{ item.evidence.assessment.score }} ({{ item.evidence.assessment.band }})
              </span>
              <span class="meta">Opened {{ item.openedAt | date: 'd MMM, HH:mm' : 'UTC' }} UTC by {{ item.openedBy }}</span>
            </button>
          } @empty {
            <p class="empty">No case has been opened yet. Open one from an alert above.</p>
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
