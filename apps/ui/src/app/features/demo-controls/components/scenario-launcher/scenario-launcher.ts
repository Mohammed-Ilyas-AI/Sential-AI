import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Starts DEMO_TAKEOVER_01. How the browser triggers the Cloud Run Job is decided with attack simulation mode. */
@Component({
  selector: 'sentinel-scenario-launcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section aria-label="Scenario launcher"></section>`,
})
export class ScenarioLauncher {}
