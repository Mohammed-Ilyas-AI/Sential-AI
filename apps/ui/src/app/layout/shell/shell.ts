import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
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
      <sentinel-demo-time-badge />
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
    }
  `,
})
export class Shell {}
