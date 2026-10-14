import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { DecisionRecord, EvidenceBundle } from '@sentinel/domain';
import { InstitutionLabelPipe } from '../../../../shared/pipes/institution-label/institution-label-pipe';
import { RiskBandBadge } from '../../../../shared/ui/risk-band-badge/risk-band-badge';

/** The account and the decision under investigation, as recorded: the gate's outcome and the advisory score. */
@Component({
  selector: 'sentinel-account-summary',
  imports: [DatePipe, DecimalPipe, InstitutionLabelPipe, RiskBandBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card" aria-label="Account summary">
      <div class="head">
        <span>
          <span class="caption">Account under investigation</span>
          <span class="account sentinel-mono">{{ decision().accountReference ?? evidence().account.accountId }}</span>
        </span>
        <span class="decision" [attr.data-decision]="decision().decision">{{ decision().decision }}</span>
      </div>
      <dl>
        <div><dt>Institution</dt><dd>{{ evidence().account.institutionId | institutionLabel }}</dd></div>
        <div><dt>Opened</dt><dd>{{ evidence().account.openedAt | date: 'd MMM y' : 'UTC' }}</dd></div>
        <div><dt>Protected balance</dt><dd>{{ evidence().account.protected ? 'Yes' : 'No' }}</dd></div>
        <div>
          <dt>Advisory score</dt>
          <dd><b class="sentinel-figures">{{ evidence().assessment.score }}</b> <sentinel-risk-band-badge [band]="evidence().assessment.band" /></dd>
        </div>
        <div><dt>24h drain</dt><dd class="sentinel-figures">{{ evidence().drain.drainPct | number: '1.1-1' }}%</dd></div>
        <div class="wide"><dt>Policy</dt><dd class="sentinel-mono">{{ decision().reasonCodes.join(', ') }}</dd></div>
      </dl>
    </section>
  `,
  styles: `
    .card {
      padding: var(--sentinel-space-4);
      border: 1px solid var(--sentinel-color-border);
      border-radius: var(--sentinel-radius-medium);
      background: var(--sentinel-color-surface);
    }
    .head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--sentinel-space-3);
    }
    .caption {
      display: block;
      color: var(--sentinel-color-text-muted);
      font-size: var(--sentinel-font-size-caption);
    }
    .account {
      font-size: var(--sentinel-font-size-title);
    }
    .decision {
      padding: 2px 10px;
      border-radius: var(--sentinel-radius-pill);
      border: 1px solid var(--sentinel-color-border);
      font-weight: 600;
      font-size: var(--sentinel-font-size-caption);
    }
    .decision[data-decision='HOLD'] {
      color: var(--sentinel-color-hold);
      border-color: color-mix(in srgb, var(--sentinel-color-hold) 55%, transparent);
    }
    dl {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: var(--sentinel-space-3);
      margin: var(--sentinel-space-4) 0 0;
    }
    dt {
      color: var(--sentinel-color-text-muted);
      font-size: var(--sentinel-font-size-micro);
    }
    .wide {
      grid-column: 1 / -1;
    }
    dd {
      display: flex;
      align-items: center;
      gap: var(--sentinel-space-2);
      margin: 2px 0 0;
      overflow-wrap: anywhere;
    }
  `,
})
export class AccountSummary {
  readonly decision = input.required<DecisionRecord>();
  readonly evidence = input.required<EvidenceBundle>();
}
