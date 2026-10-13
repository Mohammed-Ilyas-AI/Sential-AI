import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Icon } from '../../shared/ui/icon/icon';
import { MODULE_CATALOGUE, type ModuleId } from './module-catalogue';

/** A workspace that has not shipped yet says so plainly, and points to where its data already lives. */
@Component({
  selector: 'sentinel-module-overview-page',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header>
      <span class="tile"><sentinel-icon [name]="module().icon" [size]="24" /></span>
      <div>
        <h1>{{ module().title }}</h1>
        <p class="summary">{{ module().summary }}</p>
      </div>
    </header>
    <section class="sentinel-panel" aria-labelledby="module-plan">
      <p class="sentinel-eyebrow" id="module-plan">This workspace will show</p>
      <ul>
        @for (capability of module().capabilities; track capability) {
          <li><sentinel-icon name="check" [size]="16" />{{ capability }}</li>
        }
      </ul>
      <p class="now"><span class="pill">Available now</span>{{ module().availableNow }}</p>
    </section>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--sentinel-space-6);
      max-width: 880px;
      animation: sentinel-enter var(--sentinel-motion-duration-slow) var(--sentinel-motion-easing-standard);
    }
    header {
      display: flex;
      gap: var(--sentinel-space-4);
      align-items: flex-start;
    }
    .tile {
      display: grid;
      place-items: center;
      width: 48px;
      height: 48px;
      flex: none;
      border-radius: var(--sentinel-radius-large);
      background: var(--sentinel-color-accent-soft);
      border: 1px solid color-mix(in srgb, var(--sentinel-color-accent) 30%, transparent);
      color: var(--sentinel-color-accent);
    }
    h1 {
      margin: 0;
      font-size: var(--sentinel-font-size-headline);
      font-weight: 600;
      letter-spacing: -0.02em;
    }
    .summary {
      margin: var(--sentinel-space-1) 0 0;
      color: var(--sentinel-color-text-secondary);
    }
    section {
      padding: var(--sentinel-space-6);
    }
    ul {
      list-style: none;
      margin: var(--sentinel-space-4) 0;
      padding: 0;
      display: grid;
      gap: var(--sentinel-space-3);
    }
    li {
      display: flex;
      gap: var(--sentinel-space-3);
      align-items: center;
    }
    li sentinel-icon {
      color: var(--sentinel-color-success);
    }
    .now {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sentinel-space-3);
      align-items: center;
      margin: 0;
      padding-top: var(--sentinel-space-4);
      border-top: 1px solid var(--sentinel-color-border-soft);
      color: var(--sentinel-color-text-secondary);
      font-size: var(--sentinel-font-size-caption);
    }
    .pill {
      padding: 2px 10px;
      border-radius: var(--sentinel-radius-pill);
      background: color-mix(in srgb, var(--sentinel-color-success) 14%, transparent);
      color: var(--sentinel-color-success);
      font-weight: 600;
    }
  `,
})
export class ModuleOverviewPage {
  /** Bound from route data by withComponentInputBinding. */
  readonly moduleId = input.required<ModuleId>();
  protected readonly module = computed(() => MODULE_CATALOGUE[this.moduleId()]);
}
