/**
 * Canvas cannot resolve CSS custom properties, so canvas components read the theme's colour tokens once per
 * theme change. Only plain hex values are accepted (the canvas palettes in design-system/themes are hex by
 * contract); anything else falls back, so a malformed token can never break drawing.
 */
export function readHexToken(element: Element, token: string, fallback: string): string {
  const value = getComputedStyle(element).getPropertyValue(token).trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

export function readNumberToken(element: Element, token: string, fallback: number): number {
  const value = Number.parseFloat(getComputedStyle(element).getPropertyValue(token));
  return Number.isFinite(value) ? value : fallback;
}

/** `#rrggbb` at the given opacity, as a canvas colour string. */
export function hexWithAlpha(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}
