import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MinorUnitsCurrencyPipe } from '../../../../shared/pipes/minor-units-currency/minor-units-currency-pipe';
import { Icon } from '../../../../shared/ui/icon/icon';
import { PoliciesFacade } from '../../data-access/policies-facade';

/**
 * The policy gate, the decision logic and the versions on record. The gate's parameters are the published
 * configuration; every count is from the decisions on the live tape. The risk score is shown beside the
 * decisions to make the point plainly: bands are advisory, the gate decides.
 */
@Component({
  selector: 'sentinel-policy-panels',
  imports: [DatePipe, Icon, MinorUnitsCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (view()) {
      @case ('gate') {
        <section class="panel gate">
          <header>
            <span class="badge"><sentinel-icon name="policy" [size]="22" /></span>
            <div>
              <h2>{{ facade.ruleId }} · Rapid drain gate</h2>
              <p>The only deterministic decision point. Policy {{ facade.policy.policyVersion }}, applied to every scored outflow.</p>
            </div>
          </header>
          <div class="params">
            <div><span>Protected balance</span><b>{{ facade.policy.protectedBalance | minorUnitsCurrency }}</b><small>and above</small></div>
            <div><span>Gate</span><b>&gt; {{ facade.policy.gatePercent }}%</b><small>of window opening balance</small></div>
            <div><span>Rolling window</span><b>{{ facade.policy.windowHours }} h</b><small>outflow measured over</small></div>
            <div><span>Hold</span><b>{{ facade.policy.holdHours }} h</b><small>until auto-release</small></div>
            <div><span>Cooling-off</span><b>{{ facade.coolingOffHours }} h</b><small>after a high-risk event</small></div>
          </div>
        </section>
        <section class="panel">
          <h3>Outcomes on the live tape <span>({{ facade.kpis().decided }} decisions)</span></h3>
          <ul class="outcomes">
            @for (outcome of facade.outcomes(); track outcome.code) {
              <li>
                <span class="mono code">{{ outcome.code }}</span>
                <span class="meaning">{{ outcome.meaning }}</span>
                <span class="bar"><span [style.width.%]="facade.kpis().decided ? (outcome.count / facade.kpis().decided) * 100 : 0"></span></span>
                <b class="mono">{{ outcome.count }}</b>
              </li>
            }
          </ul>
        </section>
      }
      @case ('logic') {
        <section class="panel">
          <h3>Risk bands and the decisions recorded in them</h3>
          <p class="lead">The score (0–{{ facade.maxScore }}) is advisory: it ranks attention. Only the {{ facade.ruleId }} gate decides ALLOW, HOLD or REJECT, so every band can contain every decision.</p>
          <div class="scale" aria-hidden="true">
            @for (band of facade.bands(); track band.band) {
              <span [attr.data-band]="band.band" [style.flex]="band.to - band.from + 1">{{ band.band }} {{ band.from }}–{{ band.to }}</span>
            }
          </div>
          <table>
            <thead>
              <tr><th scope="col">Band</th><th scope="col">Score</th><th scope="col">ALLOW</th><th scope="col">HOLD</th><th scope="col">REJECT</th></tr>
            </thead>
            <tbody>
              @for (band of facade.bands(); track band.band) {
                <tr>
                  <th scope="row"><span class="chip" [attr.data-band]="band.band">{{ band.band }}</span></th>
                  <td class="mono">{{ band.from }}–{{ band.to }}</td>
                  <td class="mono">{{ band.allow }}</td>
                  <td class="mono hold">{{ band.hold }}</td>
                  <td class="mono hold">{{ band.reject }}</td>
                </tr>
              }
            </tbody>
          </table>
        </section>
        <section class="panel">
          <h3>Advisory intelligence</h3>
          <p class="lead">Gemini explains and summarises evidence on request. It is never in the decision path and cannot change a decision, a score or a hold.</p>
        </section>
      }
      @case ('versions') {
        <section class="panel">
          <h3>Versions stamped on recorded decisions</h3>
          <table>
            <thead>
              <tr><th scope="col">Policy</th><th scope="col">Ruleset</th><th scope="col">Decisions</th><th scope="col">First seen (UTC)</th><th scope="col">Last seen (UTC)</th></tr>
            </thead>
            <tbody>
              @for (version of facade.versions(); track version.policyVersion + version.rulesetVersion) {
                <tr>
                  <td class="mono">{{ version.policyVersion }}</td>
                  <td class="mono">{{ version.rulesetVersion }}</td>
                  <td class="mono">{{ version.count }}</td>
                  <td>{{ version.first | date: 'd MMM y, HH:mm:ss' : 'UTC' }}</td>
                  <td>{{ version.last | date: 'd MMM y, HH:mm:ss' : 'UTC' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="empty">No decisions on the tape yet.</td></tr>
              }
            </tbody>
          </table>
          <p class="lead">A threshold or weight changes only by publishing a new version; earlier decisions keep the version they were made under.</p>
        </section>
      }
    }
  `,
  styleUrl: './policy-panels.css',
})
export class PolicyPanels {
  readonly view = input.required<'gate' | 'logic' | 'versions'>();
  protected readonly facade = inject(PoliciesFacade);
}
