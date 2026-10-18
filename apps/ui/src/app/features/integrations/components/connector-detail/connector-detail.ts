import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { Icon } from '../../../../shared/ui/icon/icon';
import { IntegrationsFacade } from '../../data-access/integrations-facade';

type Tab = 'overview' | 'configuration' | 'flow' | 'health';

/** The selected connector: what it is, how its status is known, its non-secret configuration and its probes. */
@Component({
  selector: 'sentinel-connector-detail',
  imports: [DatePipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (facade.selected(); as item) {
      <header>
        <div>
          <span class="kind">{{ item.category }} · {{ item.kind }}</span>
          <h2>{{ item.name }}</h2>
        </div>
        <button type="button" class="close" aria-label="Close connector details" (click)="facade.selectedId.set(null)"><sentinel-icon name="close" [size]="16" /></button>
      </header>
      <p class="status" [attr.data-status]="item.status"><span class="dot"></span>{{ label[item.status] }}</p>
      <nav class="tabs" role="tablist" aria-label="Connector details">
        <button type="button" role="tab" [attr.aria-selected]="tab() === 'overview'" (click)="tab.set('overview')">Overview</button>
        <button type="button" role="tab" [attr.aria-selected]="tab() === 'configuration'" (click)="tab.set('configuration')">Configuration</button>
        <button type="button" role="tab" [attr.aria-selected]="tab() === 'flow'" (click)="tab.set('flow')">Data flow</button>
        @if (item.probe) {
          <button type="button" role="tab" [attr.aria-selected]="tab() === 'health'" (click)="tab.set('health')">Health</button>
        }
      </nav>
      <div class="body sentinel-scroll">
        @switch (tab()) {
          @case ('overview') {
            <p>{{ item.description }}</p>
            <dl>
              <div><dt>Endpoint</dt><dd class="mono">{{ item.endpoint }}</dd></div>
              <div><dt>Environment</dt><dd>{{ item.environment }}</dd></div>
              <div><dt>Status basis</dt><dd>{{ item.basis }}</dd></div>
              <div><dt>Last confirmed</dt><dd>{{ item.lastSync ? (item.lastSync | date: 'd MMM y, HH:mm:ss' : 'UTC') + ' UTC' : 'Not confirmed from the browser' }}</dd></div>
            </dl>
          }
          @case ('configuration') {
            <dl>
              @for (fact of item.configuration; track fact.label) {
                <div>
                  <dt>{{ fact.label }}</dt>
                  <dd [class.secret]="fact.secret">
                    @if (fact.secret) {
                      <sentinel-icon name="lock" [size]="13" /> <span class="mask" aria-label="Value hidden">••••••••</span> {{ fact.value }}
                    } @else {
                      <span class="mono">{{ fact.value }}</span>
                    }
                  </dd>
                </div>
              }
            </dl>
            <p class="note">Connections are provisioned through deployment configuration; they cannot be edited here.</p>
          }
          @case ('flow') {
            <dl>
              @for (fact of item.flow; track fact.label) {
                <div><dt>{{ fact.label }}</dt><dd class="mono">{{ fact.value }}</dd></div>
              }
            </dl>
          }
          @case ('health') {
            <ol class="probes">
              @for (probe of facade.probeHistory().slice().reverse(); track probe.at) {
                <li [attr.data-ok]="probe.ok">
                  <b>{{ probe.ok ? 'Answered' : 'No answer' }}</b> · {{ probe.latencyMs }} ms
                  <span>{{ probe.at | date: 'HH:mm:ss' : 'UTC' }} UTC · {{ probe.detail }}</span>
                </li>
              } @empty {
                <li>No probe yet.</li>
              }
            </ol>
          }
        }
      </div>
      <div class="actions">
        @if (item.probe) {
          <button type="button" [disabled]="facade.probing()" (click)="facade.refresh()"><sentinel-icon name="activity" [size]="16" /> {{ facade.probing() ? 'Testing…' : 'Test connection' }}</button>
        }
        @if (item.auditQuery) {
          <button type="button" (click)="facade.viewLogs(item)"><sentinel-icon name="audit" [size]="16" /> View logs</button>
        }
      </div>
    } @else {
      <div class="placeholder">
        <sentinel-icon name="integrations" [size]="28" />
        <p>Select a connector to see its configuration, data flow and health.</p>
      </div>
    }
  `,
  styleUrl: './connector-detail.css',
})
export class ConnectorDetail {
  protected readonly facade = inject(IntegrationsFacade);
  protected readonly tab = signal<Tab>('overview');
  protected readonly label: Readonly<Record<string, string>> = {
    HEALTHY: 'Healthy · observed',
    DEGRADED: 'Degraded · observed',
    UNAVAILABLE: 'Unavailable · observed',
    IDLE: 'Idle · no recent activity',
    INFERRED: 'Healthy · inferred from live data',
    UNOBSERVABLE: 'Not observable from the browser',
  };

  constructor() {
    effect(() => {
      void this.facade.selectedId();
      this.tab.set('overview');
    });
  }
}
