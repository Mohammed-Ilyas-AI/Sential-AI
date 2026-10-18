import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TenantLensPreference } from '../../core/tenancy/tenant-lens';
import { Icon } from '../../shared/ui/icon/icon';

/** The data lens: which institution's analyst is looking. Applied by the servers, not hidden in the browser. */
@Component({
  selector: 'sentinel-data-lens-settings',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h3 id="data-lens-title"><sentinel-icon name="lock" [size]="16" />Data lens</h3>
    <div class="segmented" role="radiogroup" aria-labelledby="data-lens-title">
      <button type="button" role="radio" [attr.aria-checked]="lens.lens() === null" (click)="lens.select(null)">Operator</button>
      @for (option of lens.options; track option) {
        <button type="button" role="radio" [attr.aria-checked]="lens.lens() === option" (click)="lens.select(option)">{{ label(option) }}</button>
      }
    </div>
    <p class="note">
      Viewing as a bank, sentinel-core and the live stream return that bank's own records in full; another bank's accounts appear as
      ••••4921 with band and hop count only, and its transactions are withheld. Designed as a multi-tenant platform; demonstrated as a
      single deployment on synthetic data. This is a projection, not tenant isolation.
    </p>
  `,
  styles: `
    :host {
      display: block;
    }
    h3 {
      display: flex;
      align-items: center;
      gap: var(--sentinel-space-2);
      margin: 0 0 var(--sentinel-space-3);
      font-size: var(--sentinel-font-size-body);
      font-weight: 600;
    }
    h3 sentinel-icon {
      color: var(--sentinel-color-accent);
    }
    .segmented {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 4px;
      padding: 4px;
      border: 1px solid var(--sentinel-color-border);
      border-radius: var(--sentinel-radius-medium, 10px);
    }
    .segmented button {
      padding: 6px 4px;
      border: 0;
      border-radius: 7px;
      background: none;
      color: var(--sentinel-color-text-secondary);
      font: inherit;
      font-size: var(--sentinel-font-size-caption);
      font-weight: 600;
      cursor: pointer;
    }
    .segmented [aria-checked='true'] {
      background: color-mix(in srgb, var(--sentinel-color-accent) 14%, transparent);
      color: var(--sentinel-color-accent-text, var(--sentinel-color-accent));
    }
    .note {
      margin: var(--sentinel-space-2) 0 0;
      color: var(--sentinel-color-text-secondary);
      font-size: var(--sentinel-font-size-caption);
    }
  `,
})
export class DataLensSettings {
  protected readonly lens = inject(TenantLensPreference);
  protected label(id: string): string {
    return id.replace(/^BANK_/, 'Bank ');
  }
}
