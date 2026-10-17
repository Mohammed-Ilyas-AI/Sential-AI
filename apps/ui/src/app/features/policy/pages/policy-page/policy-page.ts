import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MinorUnitsCurrencyPipe } from '../../../../shared/pipes/minor-units-currency/minor-units-currency-pipe';
import { PageHeader } from '../../../../shared/ui/page-header/page-header';
import { RiskBandBadge } from '../../../../shared/ui/risk-band-badge/risk-band-badge';
import { PolicyFacade } from '../../data-access/policy-facade';

/** Policy & rules (M§5.7): the SG-RD-50 gate that decides, and the seven rules that explain. */
@Component({
  selector: 'sentinel-policy-page',
  imports: [PageHeader, MinorUnitsCurrencyPipe, RiskBandBadge],
  providers: [PolicyFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sentinel-page-header
      heading="Policy & rules"
      summary="The published rapid-drain control that decides, and the seven advisory rules whose points explain. Rules decide. AI explains. Humans authorize."
    />
    <div class="layout">
      <section class="sentinel-panel sentinel-section gate" aria-labelledby="gate-title">
        <header>
          <h2 id="gate-title">SG-RD-50 · rapid account-draining safeguard</h2>
          <span class="sentinel-chip" data-tone="critical">Decides · {{ facade.policy.policyVersion }}</span>
        </header>
        <p class="statement">
          A transfer from a protected account is <b>held</b> when it, with the previous {{ facade.policy.windowHours }} hours of outflows, moves
          <b>more than {{ facade.policy.gatePercent }}%</b> of the balance at the start of the window. The hold lasts
          {{ facade.policy.holdHours }} hours, unless the customer verifies or the bank confirms fraud first.
        </p>
        <dl>
          <div><dt>Protected balance</dt><dd class="mono">{{ facade.policy.protectedBalance | minorUnitsCurrency }} or more</dd></div>
          <div><dt>Gate</dt><dd class="mono">&gt; {{ facade.policy.gatePercent }}% in {{ facade.policy.windowHours }}h</dd></div>
          <div><dt>Hold</dt><dd class="mono">{{ facade.policy.holdHours }}h, then auto-release</dd></div>
          <div><dt>Cascade</dt><dd>Every later eligible outflow is held until the cooling period ends (ADR-008)</dd></div>
          <div><dt>Outside the gate</dt><dd>Standing instructions, GIRO/eGIRO, bills to designated billing organisations</dd></div>
          <div><dt>Language model</dt><dd>Never consulted. The gate is deterministic code.</dd></div>
        </dl>
      </section>

      <section class="sentinel-panel sentinel-section" aria-labelledby="versions-title">
        <header><h2 id="versions-title">Versions in force</h2></header>
        <dl>
          <div><dt>Default policy</dt><dd class="mono">{{ facade.policy.policyVersion }}</dd></div>
          <div><dt>Ruleset</dt><dd class="mono">{{ facade.rulesetVersion }}</dd></div>
        </dl>
        <p class="sentinel-muted">Seen on the live tape:</p>
        @for (entry of facade.versionsInForce(); track entry.versions) {
          <p class="mono version">{{ entry.versions }} <span class="sentinel-muted">· {{ entry.decisions }} decisions</span></p>
        } @empty {
          <p class="sentinel-empty">No decision yet.</p>
        }
        <p class="sentinel-muted">Changing any threshold requires a new policy version; every decision records the one it ran under.</p>
      </section>

      <section class="sentinel-panel sentinel-section rules" aria-labelledby="rules-title">
        <header>
          <h2 id="rules-title">Advisory risk rules</h2>
          <span class="sentinel-muted">The score is the sum of contributions, capped at {{ facade.maxScore }}. It ranks the queue; it never decides.</span>
        </header>
        <div class="sentinel-table-wrap">
          <table class="sentinel-table">
            <thead>
              <tr><th scope="col">Code</th><th scope="col">Rule</th><th scope="col">Scores when</th><th scope="col" class="numeric">Max points</th><th scope="col">Weight</th></tr>
            </thead>
            <tbody>
              @for (rule of facade.rules; track rule.code) {
                <tr>
                  <td class="mono">{{ rule.code }}</td>
                  <td>{{ rule.label }}</td>
                  <td class="sentinel-muted">{{ rule.fires }}</td>
                  <td class="numeric mono">{{ rule.maxPoints }}</td>
                  <td class="weight"><div class="sentinel-meter"><span [style.width.%]="(rule.maxPoints / facade.largestRule) * 100"></span></div></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <section class="sentinel-panel sentinel-section" aria-labelledby="bands-title">
        <header><h2 id="bands-title">Risk bands</h2></header>
        <ul class="bands">
          @for (band of facade.bands; track band.band) {
            <li><sentinel-risk-band-badge [band]="band.band" /> <span class="mono">{{ band.from }}–{{ band.to }}</span></li>
          }
        </ul>
        <p class="sentinel-muted">Gemini may explain a band in prose. It may not add, remove or re-weight a contribution, and it may not recommend releasing a hold.</p>
      </section>
    </div>
  `,
  styles: `
    .layout { display: grid; grid-template-columns: minmax(0, 2fr) minmax(260px, 1fr); gap: var(--sentinel-space-4); align-items: start; }
    .rules { grid-column: 1; }
    @media (max-width: 960px) { .layout { grid-template-columns: 1fr; } .rules { grid-column: auto; } }
    .gate { border-color: color-mix(in srgb, var(--sentinel-color-hold) 45%, transparent); }
    .statement { margin: 0 0 var(--sentinel-space-3); line-height: var(--sentinel-line-height-body); }
    dl { display: grid; gap: var(--sentinel-space-2); margin: 0; }
    dl div { display: grid; grid-template-columns: 160px 1fr; gap: var(--sentinel-space-3); font-size: var(--sentinel-font-size-caption); }
    dt { color: var(--sentinel-color-text-secondary); }
    dd { margin: 0; }
    .mono { font-family: var(--sentinel-font-family-mono); }
    .version { margin: var(--sentinel-space-1) 0; font-size: var(--sentinel-font-size-caption); }
    .weight { min-width: 120px; }
    .bands { display: grid; gap: var(--sentinel-space-2); margin: 0 0 var(--sentinel-space-3); padding: 0; list-style: none; }
    .bands li { display: flex; align-items: center; gap: var(--sentinel-space-3); }
    p { margin: var(--sentinel-space-2) 0 0; }
  `,
})
export class PolicyPage {
  protected readonly facade = inject(PolicyFacade);
}
