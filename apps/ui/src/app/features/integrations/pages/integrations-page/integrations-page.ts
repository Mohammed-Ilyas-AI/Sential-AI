import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { InstitutionLabelPipe } from '../../../../shared/pipes/institution-label/institution-label-pipe';
import { PageHeader } from '../../../../shared/ui/page-header/page-header';
import { IntegrationsFacade } from '../../data-access/integrations-facade';

/** The contracts a participating bank uses. The simulator plays Bank A, B and C over exactly these. */
const CONTRACTS = [
  { name: 'Pre-transaction decision', method: 'POST', path: '/v1/decision/transactions', mode: 'Synchronous, < 500 ms', direction: 'Bank → SENTINEL' },
  { name: 'Account security events', method: 'POST', path: '/v1/events/security', mode: 'Synchronous', direction: 'Bank → SENTINEL' },
  { name: 'Account reports', method: 'PUT', path: '/v1/accounts/:accountToken', mode: 'Synchronous', direction: 'Bank → SENTINEL' },
  { name: 'Transaction lifecycle', method: 'Pub/Sub', path: 'sentinel-transaction-events → /internal/pubsub/transaction-events', mode: 'Ordered per account, OIDC push', direction: 'Bank → SENTINEL' },
  { name: 'Hold exceptions', method: 'POST', path: '/v1/interventions/:transactionId/…', mode: 'Customer verification, cancellation, fraud confirmation', direction: 'Bank → SENTINEL' },
  { name: 'Analyst live feed', method: 'WebSocket', path: '/stream', mode: 'Change streams, snapshot on reconnect', direction: 'SENTINEL → analyst' },
  { name: 'Gemini', method: 'HTTPS', path: 'Gemini API or Vertex AI, from sentinel-core only', mode: 'Advisory, never on the decision path', direction: 'SENTINEL → Google AI' },
] as const;

@Component({
  selector: 'sentinel-integrations-page',
  imports: [PageHeader, InstitutionLabelPipe, DatePipe],
  providers: [IntegrationsFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sentinel-page-header
      heading="Integrations"
      summary="How participating institutions connect, and whether each link is up now. Demonstrated with three synthetic banks over the same contracts a bank would use."
    />
    <div class="sentinel-workspace">
      <div class="sentinel-stats">
        <div class="sentinel-panel sentinel-stat">
          <span class="sentinel-stat__value" [attr.data-health]="facade.core$().health">{{ facade.core$().health }}</span>
          <span class="sentinel-stat__label">
            sentinel-core decision API
            @if (facade.core$().uptimeSeconds !== null) {
              · up {{ facade.core$().uptimeSeconds }}s
            }
          </span>
        </div>
        <div class="sentinel-panel sentinel-stat">
          <span class="sentinel-stat__value" [attr.data-health]="facade.streamStatus() === 'LIVE' ? 'UP' : 'CHECKING'">{{ facade.streamStatus() }}</span>
          <span class="sentinel-stat__label">sentinel-stream WebSocket</span>
        </div>
        <div class="sentinel-panel sentinel-stat">
          <span class="sentinel-stat__value">{{ facade.institutions().length }}</span><span class="sentinel-stat__label">Institutions seen on the tape</span>
        </div>
        <div class="sentinel-panel sentinel-stat">
          <span class="sentinel-stat__value">Advisory</span><span class="sentinel-stat__label">Gemini: server-side, off the decision path</span>
        </div>
      </div>

      <section class="sentinel-panel sentinel-section" aria-labelledby="institutions-title">
        <header>
          <h2 id="institutions-title">Participating institutions</h2>
          <span class="sentinel-muted">
            Synthetic banks, from the live tape
            @if (facade.core$().checkedAt; as checkedAt) {
              · health checked {{ checkedAt | date: 'HH:mm:ss' }}
            }
          </span>
        </header>
        @if (facade.institutions().length === 0) {
          <p class="sentinel-empty">No institution has sent traffic yet.</p>
        } @else {
          <table class="sentinel-table">
            <thead><tr><th scope="col">Institution</th><th scope="col" class="numeric">Transfers sent</th><th scope="col" class="numeric">Received</th><th scope="col" class="numeric">Held at source</th><th scope="col">Link</th></tr></thead>
            <tbody>
              @for (bank of facade.institutions(); track bank.institutionId) {
                <tr>
                  <td>{{ bank.institutionId | institutionLabel }}</td>
                  <td class="numeric mono">{{ bank.sent }}</td>
                  <td class="numeric mono">{{ bank.received }}</td>
                  <td class="numeric mono">{{ bank.held }}</td>
                  <td><span class="sentinel-chip" [attr.data-tone]="bank.sent > 0 ? 'success' : 'info'">{{ bank.sent > 0 ? 'sending' : 'receiving only' }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        }
      </section>

      <section class="sentinel-panel sentinel-section" aria-labelledby="contracts-title">
        <header><h2 id="contracts-title">Contracts</h2><span class="sentinel-muted">Synthetic data only. No real bank, COSMIC or SRF integration.</span></header>
        <table class="sentinel-table">
          <thead><tr><th scope="col">Contract</th><th scope="col">Transport</th><th scope="col">Endpoint</th><th scope="col">Behaviour</th><th scope="col">Direction</th></tr></thead>
          <tbody>
            @for (contract of contracts; track contract.name) {
              <tr>
                <td>{{ contract.name }}</td>
                <td><span class="sentinel-chip">{{ contract.method }}</span></td>
                <td class="mono small">{{ contract.path }}</td>
                <td class="sentinel-muted">{{ contract.mode }}</td>
                <td class="sentinel-muted">{{ contract.direction }}</td>
              </tr>
            }
          </tbody>
        </table>
      </section>
    </div>
  `,
  styles: `
    .mono { font-family: var(--sentinel-font-family-mono); }
    .small { font-size: var(--sentinel-font-size-micro); }
    [data-health='UP'] { color: var(--sentinel-color-success); }
    [data-health='DOWN'] { color: var(--sentinel-color-critical-text); }
    [data-health='CHECKING'] { color: var(--sentinel-color-warning); }
  `,
})
export class IntegrationsPage {
  protected readonly facade = inject(IntegrationsFacade);
  protected readonly contracts = CONTRACTS;
}
