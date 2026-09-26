import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { DemoTimeBadge, GeminiOutageToggle } from '../../features/demo-controls';
import { Navigation } from '../navigation/navigation';
import { TopBar } from '../top-bar/top-bar';

/** One operator surface, no mode-switching: the shell frames every feature route. */
@Component({
  selector: 'sentinel-shell',
  imports: [RouterOutlet, TopBar, Navigation, DemoTimeBadge, GeminiOutageToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sentinel-top-bar>
      <sentinel-demo-time-badge [enabled]="demoTimeCompression" />
      <sentinel-gemini-outage-toggle />
    </sentinel-top-bar>
    <sentinel-navigation />
    <main>
      <router-outlet />
    </main>
  `,
  styles: `
    main {
      padding: var(--sentinel-space-4);
      max-width: 1600px;
      margin: 0 auto;
    }
  `,
})
export class Shell {
  protected readonly demoTimeCompression = inject(RUNTIME_CONFIG).demoTimeCompression;
}
