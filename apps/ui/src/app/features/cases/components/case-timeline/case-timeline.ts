import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MinorUnitsCurrencyPipe } from '../../../../shared/pipes/minor-units-currency/minor-units-currency-pipe';
import { CasesFacade } from '../../data-access/cases-facade';

/** Rendered from the append-only intervention log, never reconstructed. */
@Component({
  selector: 'sentinel-case-timeline',
  imports: [DatePipe, MinorUnitsCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="timeline surface" aria-labelledby="timeline-title">
      <h2 id="timeline-title">Recorded timeline</h2>
      @if (facade.selectedCase(); as investigationCase) {
        <ol>
          @for (transaction of investigationCase.evidence.recentTransactions; track transaction.id) {
            <li>
              <time>{{ transaction.ts | date: 'd MMM y, HH:mm:ss' : 'UTC' }} UTC</time>
              <span>{{ transaction.type }} · {{ transaction.amount | minorUnitsCurrency }} · {{ transaction.id }}</span>
            </li>
          } @empty {
            <li class="empty">No transaction records were included in this evidence bundle.</li>
          }
        </ol>
      } @else {
        <p class="empty">A case timeline appears after selecting a case.</p>
      }
    </section>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .timeline { padding: 16px; border: 1px solid var(--sentinel-surface-panel-border); border-radius: 12px; background: var(--sentinel-color-surface); }
    h2 { margin: 0 0 10px; font-size: 1rem; }
    ol { display: grid; gap: 8px; max-height: 250px; margin: 0; padding: 0; overflow: auto; list-style: none; }
    li { display: grid; gap: 3px; padding-left: 12px; border-left: 2px solid var(--sentinel-color-accent); font-size: .78rem; }
    time, .empty { color: var(--sentinel-color-text-secondary); font-size: .72rem; }
  `],
})
export class CaseTimeline {
  protected readonly facade = inject(CasesFacade);
}
