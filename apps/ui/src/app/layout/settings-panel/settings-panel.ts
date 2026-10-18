import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { DEFAULT_RAPID_DRAIN_POLICY, DEMO_TIME_COMPRESSION_FACTOR } from '@sentinel/domain';
import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { Icon } from '../../shared/ui/icon/icon';
import { sessionFeature } from '../../state/session/session.feature';
import { ShellState } from '../shell/shell-state';
import { AppearanceSettings } from './appearance-settings';
import { DataLensSettings } from './data-lens-settings';
import { ScenarioLauncher } from '../../features/demo-controls';
import { KEYBOARD_SHORTCUTS } from './keyboard-shortcuts';

/** A right-hand drawer. Everything here is either a real preference or a read-only fact about this deployment. */
@Component({
  selector: 'sentinel-settings-panel',
  imports: [Icon, AppearanceSettings, DataLensSettings, ScenarioLauncher],
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
        <sentinel-appearance-settings />
      </section>

      <section aria-labelledby="data-lens-title">
        <sentinel-data-lens-settings />
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

      <section aria-labelledby="scenario-title">
        <h3 id="scenario-title"><sentinel-icon name="play" [size]="16" />Demo scenario</h3>
        <sentinel-scenario-launcher />
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
  protected readonly config = inject(RUNTIME_CONFIG);
  protected readonly streamStatus = inject(Store).selectSignal(sessionFeature.selectStreamStatus);
  protected readonly shortcuts = KEYBOARD_SHORTCUTS;
  protected readonly compression = DEMO_TIME_COMPRESSION_FACTOR;
  protected readonly policyVersion = DEFAULT_RAPID_DRAIN_POLICY.policyVersion;
}
