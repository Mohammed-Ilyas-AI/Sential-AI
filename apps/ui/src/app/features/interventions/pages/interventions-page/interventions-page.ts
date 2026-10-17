import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import type { InterventionState } from '@sentinel/domain';
import { MinorUnitsCurrencyPipe } from '../../../../shared/pipes/minor-units-currency/minor-units-currency-pipe';
import { PageHeader } from '../../../../shared/ui/page-header/page-header';
import { InterventionsWorkspaceFacade } from '../../data-access/interventions-workspace-facade';

const TONE: Readonly<Record<InterventionState, string>> = { HELD: 'critical', RELEASED: 'success', REJECTED: 'warning', CANCELLED: 'info' };

/** Interventions (M§5.3): every hold, how long until it auto-releases, and the append-only record of what ended it. */
@Component({
  selector: 'sentinel-interventions-page',
  imports: [PageHeader, MinorUnitsCurrencyPipe, DatePipe],
  providers: [InterventionsWorkspaceFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sentinel-page-header
      heading="Interventions"
      summary="Every hold the policy gate placed and what ended it: auto-release, customer verification, cancellation or confirmed fraud. Append-only; there is no analyst release."
    />
    <div class="sentinel-workspace">
      <div class="sentinel-stats">
        <div class="sentinel-panel sentinel-stat">
          <span class="sentinel-stat__value critical">{{ facade.counts().HELD }}</span><span class="sentinel-stat__label">Holds in force</span>
        </div>
        <div class="sentinel-panel sentinel-stat">
          <span class="sentinel-stat__value">{{ facade.valueHeld() | minorUnitsCurrency }}</span><span class="sentinel-stat__label">Value held now</span>
        </div>
        <div class="sentinel-panel sentinel-stat">
          <span class="sentinel-stat__value">{{ facade.counts().RELEASED }}</span><span class="sentinel-stat__label">Released (auto or customer-verified)</span>
        </div>
        <div class="sentinel-panel sentinel-stat">
          <span class="sentinel-stat__value">{{ facade.counts().REJECTED + facade.counts().CANCELLED }}</span><span class="sentinel-stat__label">Stopped (fraud confirmed or cancelled)</span>
        </div>
      </div>

      <section class="sentinel-panel sentinel-section" aria-labelledby="interventions-title">
        <header>
          <h2 id="interventions-title">Holds and their outcome</h2>
          <span class="sentinel-muted">Holds first, then most recent. Expand a row for its full history.</span>
        </header>
        @if (facade.rows().length === 0) {
          <p class="sentinel-empty">No intervention yet: the gate has not held a transfer.</p>
        } @else {
          <div class="sentinel-table-wrap">
            <table class="sentinel-table">
              <thead>
                <tr>
                  <th scope="col">Transaction</th>
                  <th scope="col">Account</th>
                  <th scope="col" class="numeric">Amount</th>
                  <th scope="col">State</th>
                  <th scope="col">Reason</th>
                  <th scope="col">By</th>
                  <th scope="col">Auto-release</th>
                  <th scope="col">Policy</th>
                  <th scope="col"><span class="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (row of facade.rows(); track row.latest.transactionId) {
                  <tr [class.held]="row.latest.state === 'HELD'">
                    <td class="mono">{{ row.latest.transactionId }}</td>
                    <td class="mono">{{ row.reference }}</td>
                    <td class="numeric mono">{{ row.amount === null ? '—' : (row.amount | minorUnitsCurrency) }}</td>
                    <td><span class="sentinel-chip" [attr.data-tone]="tone[row.latest.state]">{{ row.latest.state }}</span></td>
                    <td class="mono small">{{ row.latest.reasonCodes.join(', ') }}</td>
                    <td>{{ row.latest.actor.toLowerCase() }}{{ row.latest.actorIdentity ? ' · ' + row.latest.actorIdentity : '' }}</td>
                    <td class="mono">
                      @if (row.secondsLeft !== null) {
                        {{ row.secondsLeft }}s <span class="sentinel-muted">(demo time ×3600)</span>
                      } @else {
                        <span class="sentinel-muted">—</span>
                      }
                    </td>
                    <td class="mono small">{{ row.latest.policyVersion }}</td>
                    <td class="actions">
                      <button type="button" class="sentinel-link-button" (click)="toggle(row.latest.transactionId)" [attr.aria-expanded]="open() === row.latest.transactionId">
                        History ({{ row.history.length }})
                      </button>
                      @if (row.latest.state === 'HELD') {
                        <button type="button" class="sentinel-link-button" (click)="facade.work(row.latest.accountId)">Work hold →</button>
                      }
                    </td>
                  </tr>
                  @if (open() === row.latest.transactionId) {
                    <tr class="history">
                      <td colspan="9">
                        <ol>
                          @for (record of row.history; track record.id) {
                            <li>
                              <span class="mono">{{ record.actedAt | date: 'HH:mm:ss' : 'UTC' }} UTC</span>
                              <span>{{ record.previousState }} → <b>{{ record.state }}</b> by {{ record.actor.toLowerCase() }}</span>
                              <span class="mono small">{{ record.reasonCodes.join(', ') }} · score {{ record.assessment.score }} · ruleset {{ record.rulesetVersion }}</span>
                            </li>
                          }
                        </ol>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </div>
  `,
  styles: `
    .mono { font-family: var(--sentinel-font-family-mono); }
    .small { font-size: var(--sentinel-font-size-micro); }
    .critical { color: var(--sentinel-color-critical-text); }
    tr.held td:first-child { box-shadow: inset 3px 0 0 var(--sentinel-color-hold); }
    .actions { display: flex; flex-wrap: wrap; gap: var(--sentinel-space-3); }
    .history ol { display: grid; gap: var(--sentinel-space-2); margin: 0; padding-left: var(--sentinel-space-4); }
    .history li { display: flex; flex-wrap: wrap; gap: var(--sentinel-space-3); }
    .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  `,
})
export class InterventionsPage {
  protected readonly facade = inject(InterventionsWorkspaceFacade);
  protected readonly tone = TONE;
  protected readonly open = signal<string | null>(null);

  protected toggle(transactionId: string): void {
    this.open.update((current) => (current === transactionId ? null : transactionId));
  }
}
