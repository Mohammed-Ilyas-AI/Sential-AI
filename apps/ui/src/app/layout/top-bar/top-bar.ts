import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TENANT_THEME_OPTIONS, TenantLens, type TenantThemeId } from '../../core/tenant/tenant-lens';

@Component({
  selector: 'sentinel-top-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header>
      <strong>SENTINEL AI</strong>
      <span class="tagline">Detect. Explain. Intervene. Investigate.</span>
      <span class="spacer"></span>
      <ng-content />
      <label>
        <span class="sentinel-visually-hidden">Tenant view</span>
        <select [value]="lens.activeTheme()" (change)="switchTenant($event)">
          @for (option of options; track option.id) {
            <option [value]="option.id">{{ option.label }}</option>
          }
        </select>
      </label>
    </header>
  `,
  styles: `
    header {
      display: flex;
      align-items: center;
      gap: var(--sentinel-space-3);
      padding: var(--sentinel-space-3) var(--sentinel-space-4);
      border-bottom: 1px solid var(--sentinel-color-border);
      background: var(--sentinel-color-surface);
    }
    strong {
      letter-spacing: 0.02em;
    }
    .tagline {
      color: var(--sentinel-color-text-muted);
      font-size: var(--sentinel-font-size-caption);
    }
    .spacer {
      flex: 1;
    }
    @media (max-width: 700px) {
      .tagline {
        display: none;
      }
    }
    select {
      background: var(--sentinel-color-background);
      color: var(--sentinel-color-text);
      border: 1px solid var(--sentinel-color-border);
      border-radius: var(--sentinel-radius-small);
      padding: var(--sentinel-space-1) var(--sentinel-space-2);
      font: inherit;
      font-size: var(--sentinel-font-size-caption);
    }
  `,
})
export class TopBar {
  protected readonly lens = inject(TenantLens);
  protected readonly options = TENANT_THEME_OPTIONS;

  protected switchTenant(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const option = this.options.find((candidate) => candidate.id === value);
    if (option) this.lens.switchTo(option.id satisfies TenantThemeId);
  }
}
