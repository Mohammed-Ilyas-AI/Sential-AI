import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DEFAULT_RAPID_DRAIN_POLICY, type DecisionRecord, type EvidenceBundle } from '@sentinel/domain';
import { InstitutionLabelPipe } from '../../../../shared/pipes/institution-label/institution-label-pipe';
import { Icon } from '../../../../shared/ui/icon/icon';
import { RiskBandBadge } from '../../../../shared/ui/risk-band-badge/risk-band-badge';

/**
 * The account and the decision under investigation, as recorded, in one compact strip: who, how risky, how much
 * drained, what the gate decided and what the intervention record says now.
 */
@Component({
  selector: 'sentinel-account-summary',
  imports: [DatePipe, DecimalPipe, InstitutionLabelPipe, RiskBandBadge, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="strip" aria-label="Account under investigation">
      <div class="metric account">
        <span class="label"><sentinel-icon name="account" [size]="16" />Account under investigation</span>
        <span class="value sentinel-mono">{{ decision().accountReference ?? evidence().account.accountId }}</span>
        <span class="sub">{{ evidence().account.institutionId | institutionLabel }} · opened {{ evidence().account.openedAt | date: 'MMM y' : 'UTC' }}</span>
      </div>
      <div class="metric">
        <span class="label"><sentinel-icon name="shieldAlert" [size]="16" />Advisory score</span>
        <span class="value"><b class="sentinel-figures" [attr.data-band]="evidence().assessment.band">{{ evidence().assessment.score }}</b><sentinel-risk-band-badge [band]="evidence().assessment.band" /></span>
        <span class="sub">Deterministic rules engine</span>
      </div>
      <div class="metric">
        <span class="label"><sentinel-icon name="analytics" [size]="16" />24h drain</span>
        <span class="value"><b class="sentinel-figures" [class.over]="evidence().drain.thresholdMet">{{ evidence().drain.drainPct | number: '1.1-1' }}%</b></span>
        <span class="sub">Gate &gt; {{ gatePercent }}% · {{ evidence().drain.thresholdMet ? 'breached' : 'not breached' }}</span>
      </div>
      <div class="metric">
        <span class="label"><sentinel-icon name="lock" [size]="16" />Protected balance</span>
        <span class="value">{{ evidence().account.protected ? 'Yes' : 'No' }}</span>
        <span class="sub">SG-RD-50 scope</span>
      </div>
      <div class="metric">
        <span class="label"><sentinel-icon name="policy" [size]="16" />Policy decision</span>
        <span class="value"><span class="decision" [attr.data-decision]="decision().decision" title="Decided by the deterministic policy gate">{{ decision().decision }}</span></span>
        <span class="sub sentinel-mono" [title]="decision().reasonCodes.join(', ')">{{ decision().reasonCodes.join(', ') }}</span>
      </div>
      <div class="metric">
        <span class="label"><sentinel-icon name="intervention" [size]="16" />Intervention</span>
        <span class="value state" [attr.data-state]="intervention()?.state">{{ intervention() ? intervention()!.state : 'None recorded' }}</span>
        <span class="sub">{{ intervention() ? 'by ' + intervention()!.actor.toLowerCase() + ' · ' + (intervention()!.actedAt | date: 'HH:mm:ss' : '+0800') + ' SGT' : 'No hold on this transfer' }}</span>
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }
    .strip {
      display: grid;
      grid-template-columns: minmax(170px, 1.3fr) repeat(5, minmax(130px, 1fr));
      gap: var(--sentinel-space-2);
    }
    .metric {
      display: grid;
      align-content: start;
      gap: 2px;
      min-width: 0;
      padding: 10px var(--sentinel-space-3);
      border: 1px solid var(--sentinel-surface-panel-border);
      border-radius: var(--sentinel-radius-large);
      background: var(--sentinel-surface-card);
      box-shadow: var(--sentinel-elevation-panel);
    }
    .account {
      border-left: 3px solid var(--sentinel-color-accent);
    }
    .label {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--sentinel-color-text-muted);
      font-size: var(--sentinel-font-size-micro);
      font-weight: 600;
    }
    .value {
      display: flex;
      align-items: center;
      gap: var(--sentinel-space-2);
      min-height: 30px;
      font-size: var(--sentinel-font-size-title);
      font-weight: 600;
    }
    .value b {
      font-size: 1.5rem;
    }
    b[data-band='CRITICAL'] { color: var(--sentinel-color-risk-critical); }
    b[data-band='HIGH'] { color: var(--sentinel-color-risk-high); }
    b[data-band='ELEVATED'] { color: var(--sentinel-color-risk-elevated); }
    b.over { color: var(--sentinel-color-hold); }
    .sub {
      overflow: hidden;
      color: var(--sentinel-color-text-muted);
      font-size: var(--sentinel-font-size-micro);
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .decision {
      padding: 2px 12px;
      border: 1px solid currentColor;
      border-radius: var(--sentinel-radius-pill);
      font-size: var(--sentinel-font-size-caption);
      font-weight: 700;
      letter-spacing: 0.03em;
    }
    .decision[data-decision='HOLD'],
    .decision[data-decision='REJECT'] {
      color: var(--sentinel-color-hold);
      background: color-mix(in srgb, var(--sentinel-color-hold) 10%, transparent);
    }
    .decision[data-decision='ALLOW'] {
      color: var(--sentinel-color-success);
    }
    .state[data-state='HELD'],
    .state[data-state='REJECTED'] { color: var(--sentinel-color-hold); }
    .state[data-state='RELEASED'] { color: var(--sentinel-color-success); }
    @media (max-width: 1279px) {
      .strip {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }
    @media (max-width: 560px) {
      .strip {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `,
})
export class AccountSummary {
  readonly decision = input.required<DecisionRecord>();
  readonly evidence = input.required<EvidenceBundle>();

  protected readonly gatePercent = DEFAULT_RAPID_DRAIN_POLICY.gatePercent;
  /** The latest intervention the server recorded for this transfer, from the bundle. */
  protected readonly intervention = computed(
    () => this.evidence().interventions.filter((record) => record.transactionId === this.decision().transactionId).at(-1) ?? null,
  );
}
