# SENTINEL AI design system

The visual language of the analyst UI, as implemented. Sources live in `apps/ui/src/app/design-system/` and are
loaded once from `apps/ui/src/styles.css`. Components read semantic tokens only; a literal colour in a component
is a defect, not a pattern to copy. The theme architecture is recorded in
[ADR-009](../decisions/ADR-009-theme-system.md).

**Principles.** A dark operations room, readable from a distance, with a purpose-designed light alternative.
Precision over spectacle. Colour carries meaning (risk band, hold) and is never the only signal. The globe
dominates the Control Tower; panels frame it.

## 1. Theme architecture: two independent controls

| Control | Values | Attribute on `<html>` | Changes |
|---|---|---|---|
| Brand preset | SENTINEL AI (default), Bank A, Bank B, Bank C | `data-tenant-theme="bank-a\|bank-b\|bank-c"` (absent = SENTINEL AI) | Accents, neutral tint, display and UI typography |
| Appearance mode | Dark (default), Light | `data-appearance="light"` (absent = dark) | Surfaces, text, borders, shadows, glows, canvas palettes, semantic shades |

4 presets × 2 modes = **8 themes**, all from one component set and one stylesheet. `ThemePreferences`
(`core/theme/theme-preferences.ts`) owns both controls, persists them in `localStorage`
(`sentinel.theme.brand`, `sentinel.theme.appearance`) the same way the shell persists the rail, and an inline
script in `index.html` applies them before the first paint. Settings → Appearance is the only UI for them.

**Invariant.** A theme is presentation only. It never touches the store, the API, a rule, a score, a
contribution, a threshold, a decision, an intervention or any data (`theme-preferences.spec.ts` asserts the store
is byte-identical after every switch). The SENTINEL AI logo and wordmark never change: Bank A/B/C are synthetic
demo lenses, not tenant isolation, and not the branding of any real institution.

## 2. Colour

### 2.1 Neutrals and brand accents per theme

| Token | SENTINEL dark | SENTINEL light | Bank A dark / light | Bank B dark / light | Bank C dark / light |
|---|---|---|---|---|---|
| `--sentinel-color-background` | `#070b10` | `#f4f7fb` | `#0b0a0c` / `#f7f5f6` | `#061013` / `#f2f7f8` | `#090a12` / `#f4f5fb` |
| `--sentinel-color-surface` | `#0d141d` | `#ffffff` | `#141215` / `#ffffff` | `#0c171b` / `#ffffff` | `#10121c` / `#ffffff` |
| `--sentinel-color-elevated` | `#121c28` | `#f8fafc` | `#1c191e` / `#fbf9fa` | `#112127` / `#f7fbfb` | `#161926` / `#f8f9fd` |
| `--sentinel-color-border` | `#263444` | `#dce5ef` | `#322b33` / `#e7dee3` | `#22393f` / `#d5e4e6` | `#2a2e43` / `#dde0ef` |
| `--sentinel-color-text` | `#f1f5f9` | `#101828` | `#f6f2f5` / `#1d1519` | `#eef7f7` / `#0d1f22` | `#f1f3fb` / `#12142b` |
| `--sentinel-color-text-secondary` | `#a6b3c4` | `#475569` | `#b8adb5` / `#574850` | `#a2b9bc` / `#3f5659` | `#aab0c9` / `#474b6b` |
| `--sentinel-color-text-muted` | `#7a8aa0` | `#5b6b7f` | `#8f828d` / `#6f6068` | `#75949a` / `#567073` | `#7c82a2` / `#5e6383` |
| `--sentinel-color-accent` | `#36b9e7` | `#087ea4` | `#e0589f` / `#9b2370` | `#2ec4b6` / `#0f766e` | `#8088ff` / `#4f46e5` |
| `--sentinel-color-accent-strong` | `#6d8cff` | `#4f5bd5` | `#f08cb6` / `#7d1d5c` | `#3fa9d8` / `#0e6a8f` | `#4ea8ff` / `#0369a1` |
| `--sentinel-color-accent-tertiary` | `#a45cff` | `#7c3aed` | `#b36ae8` / `#7e3fb5` | `#5b8def` / `#3559c7` | `#a78bfa` / `#6d28d9` |
| `--sentinel-color-signal` (brand tiles, KPI default) | `#4aa8ff` | `#1d6fd8` | `#e0589f` / `#9b2370` | `#2ec4b6` / `#0f766e` | `#8088ff` / `#4f46e5` |
| `--sentinel-color-nav` (rail, avatar) | `#406eff` | `#2563eb` | `#c8457f` / `#9b2370` | `#1f9e93` / `#0f766e` | `#6366f1` / `#4f46e5` |

Values adjusted after contrast checks: SENTINEL dark muted text `#667589` → `#7a8aa0` (signed off 14 Oct; every
other approved dark value is unchanged); SENTINEL light muted text `#64748b` → `#5b6b7f`; Bank B dark muted
`#6c8a8c` → `#75949a`; light success `#0d8a5a` →
`#0b7a50`; Bank A and Bank C dark muted text lightened to clear 4.5:1; Bank A ruby moved toward magenta.
Derived tokens (`--sentinel-color-accent-soft`, `--sentinel-color-accent-text`, `--sentinel-gradient-brand`,
`--sentinel-color-focus`) and composite surfaces (`--sentinel-surface-ambient`, `-top-bar`, `-control`,
`-control-strong`, `-rail`, `-panel`, `-panel-border`, `-network`, `-overlay`, `-callout`, `-callout-critical`,
`-card`) are computed from the tokens above, so a bank preset tints them without a stylesheet of its own. The
SENTINEL dark composites keep the approved literal values exactly. Other tokens: `--sentinel-color-hover`,
`--sentinel-color-track`, `--sentinel-color-highlight`, `--sentinel-color-tone-ink` (lightens a tone on dark,
darkens it on light), `--sentinel-color-on-accent`, `--sentinel-brand-platform` (the wordmark blue, never
overridden by a bank).

### 2.2 Semantic colours (identical meaning in every preset)

| Token | Dark | Light | Meaning |
|---|---|---|---|
| `--sentinel-color-success` / `-risk-low` | `#36c98a` | `#0b7a50` | Approved, healthy, LOW |
| `--sentinel-color-warning` / `-risk-elevated` | `#f2b84b` | `#b45309` | Review, ELEVATED |
| `--sentinel-color-risk-high` | `#f58a4b` | `#c2410c` | HIGH band |
| `--sentinel-color-critical` / `-risk-critical` / `-hold` | `#f45b69` | `#d7263d` | CRITICAL, policy HOLD |
| `--sentinel-color-critical-soft` | `#ff6b8b` | `#e0335f` | High-risk routes on the globe |
| `--sentinel-color-critical-text` | `#ff6b7a` | `#c81e3a` | Red text on surfaces |
| `--sentinel-color-info` | `#36b9e7` | `#087ea4` | Informational, normal hotspots, routine markers |
| `--sentinel-color-series` | `#4aa8ff` | `#1d6fd8` | Neutral data: allowed rows, series bullets, contribution bars |
| `--sentinel-color-unobserved` | `#667589` | `#94a3b8` | Edges outside the observed boundary |

Light mode uses deeper shades of the same hues so they stay legible on white; the meaning never changes.

**Brand vs data rule.** Brand accents colour *chrome* only: navigation, buttons, links, the headline gradient,
KPI tiles. Anything that *encodes data* (a row marker, a series, a hotspot, a map marker, a notification
severity, a contribution bar) uses the semantic tokens above, so a ruby or teal lens can never be mistaken for a
risk state. Bank A's ruby is pushed toward magenta (hue ≈ 328°, 26–31° from the critical red) and coral was
dropped because it collides with HIGH orange; Bank B's teal (≈ 175°) stays away from success green (≈ 155°),
and emerald was dropped for the same reason. HOLD always carries its label and icon as well as colour.

### 2.3 Canvas palettes

The globe, the threat map and the rail's particle wave draw on canvas, which cannot resolve CSS. They read hex
tokens once per theme change (`shared/ui/canvas/css-color-token.ts`): `--sentinel-globe-halo`, `-ocean-1..3`,
`-rim`, `-rim-stroke`, `-land`, `-land-lit`, `-land-bright`, `-land-hot`, `-particle`, `-node`, `-marker-core`,
`-glow-strength`; `--sentinel-map-land`; `--sentinel-wave-start`, `-mid`, `-end`, `-spark`, `-strength`. These
vary by appearance only; risk tones come from the semantic tokens. In light mode the globe is a pale ocean with
navy land, the glow is reduced to 35%, and the wave draws normally instead of additively.

## 3. Typography

All fonts are **self-hosted** in `apps/ui/public/fonts` (SIL Open Font License 1.1; licences in
`public/fonts/licenses`), Latin subset, variable weight where available, `font-display: swap`. Nothing is
fetched from a third party at runtime; the two SENTINEL faces are preloaded.

| Preset | Display (`--sentinel-font-family-display`) | UI (`--sentinel-font-family-sans`) | Profile |
|---|---|---|---|
| SENTINEL AI | Sora | Plus Jakarta Sans | display weight 600, display tracking −0.02em |
| Bank A · Meridian Ruby | Manrope | Manrope | display 700, −0.015em |
| Bank B · Harbour Teal | Plus Jakarta Sans | Plus Jakarta Sans | display 700, −0.03em, UI tracking +0.005em |
| Bank C · Straits Indigo | DM Sans | DM Sans | display 700, −0.02em |
| All | `--sentinel-font-family-mono`: IBM Plex Mono 400/500/600 for IDs, timestamps, rule codes, telemetry | | |

`--sentinel-font-family-brand` (Sora) sets the SENTINEL AI wordmark in every preset. Files: Sora 33.7 kB, Plus
Jakarta Sans 27.3 kB, Manrope 24.8 kB, DM Sans 36.9 kB, IBM Plex Mono 3 × ~15 kB; a theme downloads only the
faces it uses. Sizes: micro 0.6875rem, caption 0.8125rem, body 0.875rem, title 1.125rem, headline 1.75rem,
display 2.5rem; body line height 1.5. Helpers: `.sentinel-figures` (tabular numerals), `.sentinel-mono`.

## 4. Spacing, radii, elevation, layout

| Spacing | Value | | Radius | Value |
|---|---|---|---|---|
| `--sentinel-space-1` | 4px | | `--sentinel-radius-small` | 6px |
| `--sentinel-space-2` | 8px | | `--sentinel-radius-medium` | 10px |
| `--sentinel-space-3` | 12px | | `--sentinel-radius-large` | 14px |
| `--sentinel-space-4` | 16px | | `--sentinel-radius-pill` | 999px |
| `--sentinel-space-6` | 24px | | | |
| `--sentinel-space-8` | 32px | | | |

Elevation: `--sentinel-elevation-panel`, `--sentinel-elevation-overlay` (dark: deep black shadows; light:
restrained cool shadows), `--sentinel-glow-accent` / `--sentinel-glow-critical` (derived from the active accent
and critical colour). Shell geometry: top bar 64px, rail 248/72px, mobile bottom bar 64px, touch target 44px.

## 5. Iconography

One in-house set (`shared/ui/icon/icon-paths.ts`): 24×24, 1.75 stroke, round caps, `currentColor`. No icon package
ships to the browser. The brand mark is `public/brand/sentinel-mark.png`, in the top bar only.

## 6. Motion and reduced motion

Durations 150/200/240ms; easings `cubic-bezier(0.2, 0, 0, 1)` and `cubic-bezier(0.3, 0, 0, 1.15)`. Keyframes
`sentinel-enter`, `sentinel-pop`, `sentinel-breathe` (live indicator only). Under
`prefers-reduced-motion: reduce` every duration is 0, animations run once at 0.01ms, and the globe and the
particle wave render a single still frame. Theme switches do not animate.

## 7. Breakpoints

| Range | Behaviour |
|---|---|
| ≥ 1280px | Desktop shell; Control Tower is one fixed viewport when the height is ≥ 600px |
| ≤ 1279px | Control Tower becomes one scrolling column |
| ≤ 1100px | Control Tower lower row stacks |
| ≤ 1023px | KPI cards two per row; Alerts and Investigations become one column |
| ≤ 767px | Mobile: bottom bar and navigation sheet replace the rail |
| ≤ 479px | KPI cards drop the change figure |

Height tiers for the fixed Control Tower (≥ 768px wide): default, ≤ 940px, ≤ 800px, ≤ 680px (the last also
drops the KPI change figure). `pointer: coarse` raises controls to 44px.

## 8. Accessibility checks (WCAG 2.2, computed from the tokens)

Three categories, each with its own token and threshold:

| Category | Token | Requirement | Where |
|---|---|---|---|
| Text | `--sentinel-color-text*`, semantic text tokens | 4.5:1 | All copy, labels, telemetry |
| Interactive boundary | `--sentinel-color-border-interactive` (muted text 80% over surface) | 3:1 (1.4.11) | Sidebar toggle, alert-queue items, hold-action buttons, mobile navigation links, switch track |
| Focus indicator | `--sentinel-color-focus` (2px ring, 2px offset) | 3:1 (1.4.11, 2.4.13) | Every focusable element |
| Decorative border | `--sentinel-color-border`, `-border-soft` | exempt; never the only cue | Card edges, dividers, chips |

Worst case of each colour against background, surface and elevated, computed from the token values parsed out of
the theme CSS (14 Oct 2026):

| Theme | text | secondary | muted | accent-text | success | warning | critical-text | interactive border | focus ring | decorative border |
|---|---|---|---|---|---|---|---|---|---|---|
| sentinel dark | 15.68 | 8.07 | 4.88 | 8.25 | 8.08 | 9.60 | 6.25 | 3.53 | 7.57 | 1.36 |
| sentinel light | 16.52 | 7.05 | 5.07 | 5.55 | 4.99 | 4.67 | 5.28 | 3.33 | 4.31 | 1.18 |
| bank-a dark | 15.69 | 8.02 | 4.76 | 6.44 | 8.18 | 9.72 | 6.33 | 3.45 | 5.02 | 1.27 |
| bank-a light | 16.49 | 7.90 | 5.45 | 7.97 | 4.94 | 4.63 | 5.23 | 3.50 | 6.75 | 1.21 |
| bank-b dark | 15.18 | 8.03 | 5.08 | 8.83 | 7.77 | 9.23 | 6.01 | 3.66 | 7.62 | 1.36 |
| bank-b light | 15.72 | 7.23 | 4.91 | 6.14 | 4.97 | 4.65 | 5.25 | 3.25 | 5.07 | 1.21 |
| bank-c dark | 15.78 | 8.13 | 4.64 | 7.34 | 8.22 | 9.77 | 6.36 | 3.37 | 5.73 | 1.31 |
| bank-c light | 16.63 | 7.76 | 5.38 | 6.93 | 4.93 | 4.62 | 5.21 | 3.46 | 5.78 | 1.21 |

**Result: 0 failures in all 8 themes.** Every text pair is ≥ 4.5:1, every interactive boundary and focus ring
≥ 3:1. Decorative borders (1.2–1.4:1) are exempt and never the only cue: each control they sit near has a label,
a fill or an interactive boundary. Risk bands always carry a label; held rows say HOLD.

## 9. Validation record (14 Oct 2026)

All 8 combinations were captured at 1536×864 from the production build, plus 1366×640 (SENTINEL light and
Bank A light), tablet 820×1180, phone 390×844, Settings, notifications, Alerts & Cases, Investigations, Live
Transactions and Network Analysis. Automated checks on every capture found no horizontal overflow, no truncated
KPI labels, and no Control Tower page scroll at desktop sizes; each preset loaded only its own UI face. Unit
tests cover persistence, attribute independence, tamper fallback, and the store being untouched.
