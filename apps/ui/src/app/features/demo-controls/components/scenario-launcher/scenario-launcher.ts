import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'sentinel-scenario-launcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="blocked surface" aria-labelledby="scenario-title">
      <p class="eyebrow">Synthetic demo only</p>
      <h1 id="scenario-title">Scenario launcher</h1>
      <p class="status" role="status">Launch unavailable</p>
      <p>
        This deployment has no authenticated operator identity or configured server-side Cloud Run Job invoker.
        Starting a cloud execution from an unauthenticated browser would allow uncontrolled job launches, so no
        launch button is exposed and no run has been created.
      </p>
      <p class="note">The deterministic simulator remains available through its configured local or Cloud Run Job entrypoint.</p>
    </section>
  `,
  styles: [`
    :host { display: grid; align-content: start; min-height: 100%; padding: clamp(16px, 2vw, 28px); background: var(--sentinel-color-background); color: var(--sentinel-color-text); }
    .blocked { max-width: 760px; padding: 22px; border: 1px solid var(--sentinel-surface-panel-border); border-radius: 12px; background: var(--sentinel-color-surface); }
    .eyebrow { margin: 0 0 5px; color: var(--sentinel-color-accent); font-size: .7rem; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
    h1 { margin: 0; font-size: 1.6rem; }
    .status { display: inline-block; margin: 14px 0 4px; color: var(--sentinel-color-warning); font-weight: 700; }
    p { line-height: 1.6; }
    .note { color: var(--sentinel-color-text-secondary); font-size: .82rem; }
  `],
})
export class ScenarioLauncher {}
