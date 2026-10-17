import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RiskBandBadge } from '../../../../shared/ui/risk-band-badge/risk-band-badge';
import type { CaseListItem } from '../../models/case-list-item';

@Component({
  selector: 'sentinel-case-list',
  imports: [RiskBandBadge, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (cases().length === 0) {
      <p class="sentinel-empty">No open case. A case opens when an alert is raised on an account.</p>
    } @else {
      <ul>
        @for (item of cases(); track item.caseId) {
          <li>
            <button type="button" [attr.aria-pressed]="item.accountId === selectedAccountId()" (click)="selected.emit(item.accountId)">
              <span class="top"><span class="mono">{{ item.caseId }}</span> <sentinel-risk-band-badge [band]="item.band" /></span>
              <span class="mono">{{ item.reference }} · score {{ item.score }}{{ item.onHold ? ' · on hold' : '' }}</span>
              <span class="sentinel-muted">opened {{ item.openedAt | date: 'dd MMM HH:mm' : 'UTC' }} UTC</span>
            </button>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    ul { display: grid; gap: var(--sentinel-space-2); margin: 0; padding: 0; list-style: none; }
    button { display: grid; gap: 2px; width: 100%; padding: var(--sentinel-space-3); border: 1px solid var(--sentinel-color-border-soft); border-radius: var(--sentinel-radius-medium); background: transparent; color: var(--sentinel-color-text); font: inherit; font-size: var(--sentinel-font-size-caption); text-align: left; cursor: pointer; }
    button[aria-pressed='true'] { border-color: var(--sentinel-color-accent); background: var(--sentinel-color-accent-soft); }
    button:focus-visible { outline: 2px solid var(--sentinel-color-accent); outline-offset: 2px; }
    .top { display: flex; justify-content: space-between; align-items: center; }
    .mono { font-family: var(--sentinel-font-family-mono); }
  `,
})
export class CaseList {
  readonly cases = input.required<readonly CaseListItem[]>();
  readonly selectedAccountId = input<string | null>(null);
  readonly selected = output<string>();
}
