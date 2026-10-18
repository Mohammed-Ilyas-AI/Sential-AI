import type { GeoPoint } from '../../geo/land-mask';

/** Route and marker states, in legend order. */
export type GlobeTone = 'normal' | 'elevated' | 'high' | 'held' | 'accent';

export interface GlobeMarker {
  readonly id: string;
  readonly point: GeoPoint;
  readonly tone: GlobeTone;
  /** Shown on hover and focus; the marker is a bank. */
  readonly label?: string;
}

/** An account on the tape: drawn near its bank (illustrative placement), selectable. */
export interface GlobeNode {
  readonly id: string;
  readonly point: GeoPoint;
  readonly label?: string;
}

/** One transfer on the tape, drawn from the paying account's node to the receiving institution. */
export interface GlobeRoute {
  readonly id: string;
  readonly from: GeoPoint;
  readonly to: GeoPoint;
  readonly tone: GlobeTone;
  readonly label?: string;
}

export interface GlobeScene {
  readonly markers: readonly GlobeMarker[];
  readonly nodes: readonly GlobeNode[];
  readonly routes: readonly GlobeRoute[];
  /** Destinations of held transfers: warm land glow and the intervention ring. */
  readonly holds: readonly GeoPoint[];
}

/** What a click or a key can select on the globe: a bank, an account node, or a transfer (its arc marker). */
export type GlobeTargetKind = 'bank' | 'account' | 'transaction';

export interface GlobeTarget {
  readonly kind: GlobeTargetKind;
  readonly id: string;
}

/** A selectable target where this frame drew it, in canvas CSS pixels. */
export interface GlobeHitTarget extends GlobeTarget {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly label: string;
}

export interface GlobeView {
  readonly centerLongitude: number;
  readonly centerLatitude: number;
  readonly zoom: number;
  /** Map heading in degrees, clockwise; 0 is the artwork's own orientation. */
  readonly heading?: number;
}

export interface ScreenPosition {
  readonly x: number;
  readonly y: number;
  readonly visible: boolean;
}

/** Every colour the globe draws with. Risk tones are the semantic tokens; the rest varies by appearance only. */
export interface GlobePalette {
  readonly tones: Readonly<Record<GlobeTone, string>>;
  readonly halo: string;
  readonly ocean: readonly [string, string, string];
  readonly rim: string;
  readonly rimStroke: string;
  readonly land: string;
  readonly landLit: string;
  readonly landBright: string;
  readonly landHot: string;
  readonly particle: string;
  readonly node: string;
  readonly markerCore: string;
  /** Scales the atmosphere and rim glow: full on a dark canvas, restrained on a light one. */
  readonly glowStrength: number;
  /** Rare highlights in the particle atmosphere. */
  readonly violet: string;
  /** Ring around the selected target. */
  readonly selection: string;
}

/** The approved dark globe; also what the renderer draws before the theme has been read. */
export const DARK_GLOBE_PALETTE: GlobePalette = {
  tones: { normal: '#36c98a', elevated: '#f2b84b', high: '#ff6b8b', held: '#f45b69', accent: '#36b9e7' },
  halo: '#4696ff',
  ocean: ['#16325c', '#0b1a33', '#040912'],
  rim: '#50a0ff',
  rimStroke: '#6eb4ff',
  land: '#7fb0f0',
  landLit: '#cfe2ff',
  landBright: '#fff3d6',
  landHot: '#ff6a4d',
  particle: '#9cc8ff',
  node: '#9fd4ff',
  markerCore: '#ffffff',
  glowStrength: 1,
  violet: '#a45cff',
  selection: '#ffffff',
};
