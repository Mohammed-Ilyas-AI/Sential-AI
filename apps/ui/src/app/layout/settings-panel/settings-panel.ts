import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { DEFAULT_RAPID_DRAIN_POLICY, DEMO_TIME_COMPRESSION_FACTOR } from '@sentinel/domain';
import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { TENANT_THEME_OPTIONS, TenantLens } from '../../core/tenant/tenant-lens';
import { Icon } from '../../shared/ui/icon/icon';
import { sessionFeature } from '../../state/session/session.feature';
import { ShellState } from '../shell/shell-state';
import { KEYBOARD_SHORTCUTS } from './keyboard-shortcuts';

/** A right-hand drawer. Everything here is either a real preference or a read-only fact about this deployment. */
@Component({
  selector: 'sentinel-settings-panel',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="drawer sentinel-panel--elevated sentinel-scroll" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <header>
        <h2 id="settings-title">Settings</h2>
        <button type="button" class="sentinel-icon-button" (click)="shell.close()">
          <sentinel-icon name="close" label="Close settings" />
        </button>
      </header>

      <section aria-labelledby="appearance-title">
        <h3 id="appearance-title"><sentinel-icon name="palette" [size]="16" />Appearance</h3>
        <p class="note">Tenant lens over synthetic data. Risk-band colours never change per tenant.</p>
        <div class="segmented" role="radiogroup" aria-label="Tenant theme">
          @for (option of themes; track option.id) {
            <button type="button" role="radio" [attr.aria-checked]="lens.activeTheme() === option.id" (click)="lens.switchTo(option.id)">
              {{ option.label.replace(' (synthetic)', '') }}
            </button>
          }
        </div>
        <p class="note">Motion follows your system's reduced-motion setting.</p>
      </section>

      <section aria-labelledby="workspace-title">
        <h3 id="workspace-title"><sentinel-icon name="grid" [size]="16" />Workspace</h3>
        <button type="button" class="switch" role="switch" [attr.aria-checked]="shell.sidebarExpanded()" (click)="shell.toggleSidebar()">
          <span>Expanded navigation rail</span><span class="track" aria-hidden="true"></span>
        </button>
        <button type="button" class="switch" role="switch" [attr.aria-checked]="shell.focusMode()" (click)="shell.toggleFocusMode()">
          <span>Focus mode <small>hides the rail and secondary panels</small></span><span class="track" aria-hidden="true"></span>
        </button>
      </section>

      <section aria-labelledby="notifications-settings-title">
        <h3 id="notifications-settings-title"><sentinel-icon name="bell" [size]="16" />Notifications</h3>
        <p class="note">Raised from server truth only: policy holds and their outcome, high and critical alerts, and flagged network relationships.</p>
      </section>

      <section aria-labelledby="shortcuts-title">
        <h3 id="shortcuts-title"><sentinel-icon name="keyboard" [size]="16" />Keyboard shortcuts</h3>
        <dl>
          @for (shortcut of shortcuts; track shortcut.keys) {
            <dt>{{ shortcut.action }}</dt>
            <dd><kbd>{{ shortcut.keys }}</kbd></dd>
          }
        </dl>
      </section>

      <section aria-labelledby="environment-title">
        <h3 id="environment-title"><sentinel-icon name="environment" [size]="16" />Environment</h3>
        <dl>
          <dt>Environment</dt><dd>Demo · synthetic data only</dd>
          <dt>Decision API</dt><dd class="sentinel-mono">{{ config.coreApiBaseUrl }}</dd>
          <dt>Stream</dt><dd class="sentinel-mono">{{ config.streamUrl }}</dd>
          <dt>Policy time</dt><dd>{{ config.demoTimeCompression ? 'Compressed ×' + compression : 'Real time' }}</dd>
        </dl>
      </section>

      <section aria-labelledby="status-title">
        <h3 id="status-title"><sentinel-icon name="server" [size]="16" />System status</h3>
        <dl>
          <dt>Live stream</dt><dd [attr.data-status]="streamStatus()">{{ streamStatus().toLowerCase() }}</dd>
          <dt>Policy</dt><dd class="sentinel-mono">SG-RD-50 · {{ policyVersion }}</dd>
          <dt>Decision path</dt><dd>Deterministic rules · no model in the loop</dd>
        </dl>
      </section>
    </aside>
  `,
  styleUrl: './settings-panel.css',
})
export class SettingsPanel {
  protected readonly shell = inject(ShellState);
  protected readonly lens = inject(TenantLens);
  protected readonly config = inject(RUNTIME_CONFIG);
  protected readonly streamStatus = inject(Store).selectSignal(sessionFeature.selectStreamStatus);
  protected readonly themes = TENANT_THEME_OPTIONS;
  protected readonly shortcuts = KEYBOARD_SHORTCUTS;
  protected readonly compression = DEMO_TIME_COMPRESSION_FACTOR;
  protected readonly policyVersion = DEFAULT_RAPID_DRAIN_POLICY.policyVersion;
}
