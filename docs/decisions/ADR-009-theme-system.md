# ADR-009 — One token system: brand preset × appearance mode

- **Status:** Accepted, 14 Oct 2026

## Context

The approved SENTINEL AI dark Control Tower must stay the default. The demo also needs a light mode and three
synthetic bank lenses (Bank A Meridian Ruby, Bank B Harbour Teal, Bank C Straits Indigo) with their own accent
and type, without maintaining several stylesheets, and without any lens touching what the product decides.

## Decision

- Two independent attributes on `<html>`: `data-tenant-theme` (brand preset) and `data-appearance` (light; absent
  means dark). The 8 combinations come from one set of semantic CSS custom properties. Bank presets set
  neutrals, accents and typography only; composite surfaces derive from those.
- `ThemePreferences` (the former `TenantLens`, extended) owns both controls, persists them in `localStorage`
  like the shell's rail preference, and is applied before first paint by an inline script. No new state library.
- Brand accents colour chrome only. Data encodings use semantic tokens that never change per preset
  (success, warning, critical, info, series).
- Fonts are self-hosted woff2 copied from the OFL-licensed fontsource packages
  (`@fontsource-variable/{sora,plus-jakarta-sans,manrope,dm-sans}@5.3.0`, `@fontsource/ibm-plex-mono@5.3.0`)
  into `apps/ui/public/fonts`, with the licences. They are vendored rather than installed as npm dependencies, so
  the lockfile is unchanged; the Google Fonts link is removed.
- Canvas renderers read hex palette tokens on theme change.

## Consequences

- A theme switch is presentation only and is tested as such (the store is unchanged after every switch).
- A new preset is one CSS file of neutrals, accents and fonts, plus one entry in `BRAND_PRESET_OPTIONS`.
- The SENTINEL dark values are unchanged, but the default UI face is now Plus Jakarta Sans (headings Sora)
  instead of Inter.
- Updating a vendored font means re-copying the files and licences from a newer fontsource release.
