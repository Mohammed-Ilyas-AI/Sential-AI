import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { APPEARANCE_OPTIONS, BRAND_PRESET_OPTIONS, ThemePreferences } from '../../core/theme/theme-preferences';
import { Icon } from '../../shared/ui/icon/icon';

/**
 * Appearance: the two independent theme controls and a live preview drawn with the active tokens. The preview
 * shows the semantic states on purpose — they look the same in every preset, because they carry policy meaning.
 */
@Component({
  selector: 'sentinel-appearance-settings',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h3 id="appearance-title"><sentinel-icon name="palette" [size]="16" />Appearance</h3>

    <p class="label" id="appearance-mode-label">Appearance mode</p>
    <div class="segmented" role="radiogroup" aria-labelledby="appearance-mode-label">
      @for (mode of modes; track mode.id) {
        <button type="button" role="radio" [attr.aria-checked]="theme.appearance() === mode.id" (click)="theme.selectAppearance(mode.id)">
          {{ mode.label }}
        </button>
      }
    </div>

    <p class="label" id="brand-lens-label">Demo bank lens</p>
    <div class="presets" role="radiogroup" aria-labelledby="brand-lens-label">
      @for (preset of presets; track preset.id) {
        <button type="button" role="radio" class="preset" [attr.aria-checked]="theme.brand() === preset.id" (click)="theme.selectBrand(preset.id)">
          <span class="swatch" aria-hidden="true" [style.background]="'var(--sentinel-swatch-' + preset.id + ')'"></span>
          <span class="names">
            <span class="name">{{ preset.label }}</span>
            <span class="identity">{{ preset.identity }}{{ preset.synthetic ? ' · synthetic' : '' }}</span>
          </span>
        </button>
      }
    </div>

    <figure class="preview" aria-label="Live preview of the active theme">
      <span class="eyebrow">Operations Control Tower</span>
      <span class="headline">Global <span class="gradient">Financial Defence</span> in Real Time</span>
      <span class="states">
        <span class="state" data-state="ALLOWED">ALLOWED</span>
        <span class="state" data-state="REVIEW">REVIEW</span>
        <span class="state" data-state="HOLD">HOLD</span>
        <span class="telemetry">TX-DT01-0029 · SG-RD-50</span>
      </span>
      <span class="action">View Intervention</span>
      <figcaption>{{ caption() }}</figcaption>
    </figure>

    <p class="note">
      Bank A, B and C are synthetic demo themes, not real institutions. A lens changes presentation only: never a rule, score,
      threshold, decision, hold or any data. The SENTINEL AI logo remains the platform identity. Motion follows your system's
      reduced-motion setting.
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
    .label {
      margin: 0 0 var(--sentinel-space-2);
      color: var(--sentinel-color-text-secondary);
      font-size: var(--sentinel-font-size-caption);
    }
    .segmented,
    .presets {
      display: grid;
      gap: 4px;
      padding: 4px;
      margin-bottom: var(--sentinel-space-3);
      border: 1px solid var(--sentinel-color-border-soft);
      border-radius: var(--sentinel-radius-medium);
      background: var(--sentinel-color-surface);
    }
    .segmented {
      grid-template-columns: 1fr 1fr;
    }
    .presets {
      grid-template-columns: 1fr 1fr;
    }
    button {
      min-height: 36px;
      border: 0;
      border-radius: var(--sentinel-radius-small);
      background: none;
      color: var(--sentinel-color-text-secondary);
      font: inherit;
      font-size: var(--sentinel-font-size-caption);
      cursor: pointer;
    }
    button[aria-checked='true'] {
      background: var(--sentinel-color-accent-soft);
      color: var(--sentinel-color-text);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sentinel-color-accent) 40%, transparent);
    }
    button:hover:not([aria-checked='true']) {
      background: var(--sentinel-color-hover);
    }
    .preset {
      display: flex;
      align-items: center;
      gap: var(--sentinel-space-2);
      min-height: 48px;
      padding: 6px 8px;
      text-align: left;
    }
    .swatch {
      flex: none;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.18);
    }
    .names {
      display: grid;
      min-width: 0;
    }
    .name {
      color: var(--sentinel-color-text);
      font-weight: 600;
    }
    .identity {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--sentinel-color-text-muted);
      font-size: var(--sentinel-font-size-micro);
    }
    .preview {
      display: grid;
      gap: var(--sentinel-space-2);
      margin: 0 0 var(--sentinel-space-3);
      padding: var(--sentinel-space-4);
      border: 1px solid var(--sentinel-surface-panel-border);
      border-radius: var(--sentinel-radius-large);
      background: var(--sentinel-surface-panel);
      box-shadow: var(--sentinel-elevation-panel);
    }
    .eyebrow {
      color: var(--sentinel-color-text-secondary);
      font-size: var(--sentinel-font-size-micro);
      font-weight: 600;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    .headline {
      font-family: var(--sentinel-font-family-display);
      font-size: 1.125rem;
      font-weight: 700;
      line-height: 1.25;
      letter-spacing: var(--sentinel-letter-spacing-display);
    }
    .gradient {
      background: var(--sentinel-gradient-brand);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .states {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
    }
    .state {
      --tone: var(--sentinel-color-success);
      padding: 2px 8px;
      border-radius: var(--sentinel-radius-pill);
      background: color-mix(in srgb, var(--tone) 14%, transparent);
      color: color-mix(in srgb, var(--tone) 80%, var(--sentinel-color-tone-ink));
      font-size: var(--sentinel-font-size-micro);
      font-weight: 700;
    }
    .state[data-state='REVIEW'] {
      --tone: var(--sentinel-color-warning);
    }
    .state[data-state='HOLD'] {
      --tone: var(--sentinel-color-critical);
    }
    .telemetry {
      color: var(--sentinel-color-text-muted);
      font-family: var(--sentinel-font-family-mono);
      font-size: var(--sentinel-font-size-micro);
    }
    .action {
      justify-self: start;
      padding: 4px 12px;
      border: 1px solid color-mix(in srgb, var(--sentinel-color-signal) 55%, transparent);
      border-radius: var(--sentinel-radius-small);
      background: color-mix(in srgb, var(--sentinel-color-signal) 12%, transparent);
      color: var(--sentinel-color-accent-text);
      font-size: var(--sentinel-font-size-caption);
    }
    figcaption,
    .note {
      margin: 0;
      color: var(--sentinel-color-text-muted);
      font-size: var(--sentinel-font-size-micro);
    }
    .note {
      color: var(--sentinel-color-text-secondary);
      font-size: var(--sentinel-font-size-caption);
    }
    @media (pointer: coarse) {
      button {
        min-height: var(--sentinel-touch-target);
      }
    }
  `,
})
export class AppearanceSettings {
  protected readonly theme = inject(ThemePreferences);
  protected readonly modes = APPEARANCE_OPTIONS;
  protected readonly presets = BRAND_PRESET_OPTIONS;
  protected readonly caption = computed(() => {
    const preset = BRAND_PRESET_OPTIONS.find((option) => option.id === this.theme.brand());
    const mode = this.theme.appearance() === 'light' ? 'light' : 'dark';
    return `${preset?.label ?? 'SENTINEL AI'}${preset?.synthetic ? ` (${preset.identity})` : ''}, ${mode}. Risk colours are identical in every theme.`;
  });
}
