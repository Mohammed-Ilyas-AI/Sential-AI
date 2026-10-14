import type { GeoPoint } from '../../geo/land-mask';

/** Route and marker states, in legend order. */
export type GlobeTone = 'normal' | 'elevated' | 'high' | 'held' | 'accent';

export interface GlobeMarker {
  readonly id: string;
  readonly point: GeoPoint;
  readonly tone: GlobeTone;
}

/** One transfer on the tape, drawn from the paying account's node to the receiving institution. */
export interface GlobeRoute {
  readonly id: string;
  readonly from: GeoPoint;
  readonly to: GeoPoint;
  readonly tone: GlobeTone;
}

export interface GlobeScene {
  readonly markers: readonly GlobeMarker[];
  readonly nodes: readonly GeoPoint[];
  readonly routes: readonly GlobeRoute[];
  /** Destinations of held transfers: warm land glow and the intervention ring. */
  readonly holds: readonly GeoPoint[];
}

export interface GlobeView {
  readonly centerLongitude: number;
  readonly centerLatitude: number;
  readonly zoom: number;
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
};

const RADIANS = Math.PI / 180;
const HOLD_GLOW_DEGREES = 14;
const LIGHTS_DEGREES = 9;
const ARC_SEGMENTS = 56;
const ROUTE_DRAW_IN_MS = 1_400;
const ORBITAL_PARTICLES = 220;

type Vector = [number, number, number];

const toVector = ({ latitude, longitude }: GeoPoint): Vector => [
  Math.cos(latitude * RADIANS) * Math.cos(longitude * RADIANS),
  Math.cos(latitude * RADIANS) * Math.sin(longitude * RADIANS),
  Math.sin(latitude * RADIANS),
];

function angularDistance(left: GeoPoint, right: GeoPoint): number {
  const [ax, ay, az] = toVector(left);
  const [bx, by, bz] = toVector(right);
  return Math.acos(Math.min(1, Math.max(-1, ax * bx + ay * by + az * bz))) / RADIANS;
}

function slerp(from: GeoPoint, to: GeoPoint, t: number): Vector {
  const a = toVector(from);
  const b = toVector(to);
  const omega = Math.acos(Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
  if (omega < 1e-6) return a;
  const sin = Math.sin(omega);
  const k1 = Math.sin((1 - t) * omega) / sin;
  const k2 = Math.sin(t * omega) / sin;
  return [k1 * a[0] + k2 * b[0], k1 * a[1] + k2 * b[1], k1 * a[2] + k2 * b[2]];
}

function withAlpha(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha.toFixed(3)})`;
}

type Projector = (x: number, y: number, z: number, lift?: number) => { x: number; y: number; depth: number; visible: boolean };

/**
 * An orthographic point-cloud globe on a 2D canvas: dotted continents, orbital particles, routes that draw in
 * when a decision arrives and carry a travelling pulse, and an intervention ring on every held destination.
 * Pure drawing; the component owns timing, input and data. Dot geometry is computed once; per-scene lighting
 * is computed on scene change, never per frame.
 */
export class GlobeRenderer {
  private readonly dots: readonly GeoPoint[];
  private readonly dotVectors: Float32Array;
  private heat: Float32Array;
  private lights: Float32Array;
  private scene: GlobeScene = { markers: [], nodes: [], routes: [], holds: [] };
  private palette: GlobePalette = DARK_GLOBE_PALETTE;
  private readonly routeBirth = new Map<string, number>();
  private readonly orbitals = Array.from({ length: ORBITAL_PARTICLES }, (_, index) => ({
    inclination: (((index * 47) % 180) - 90) * RADIANS,
    node: ((index * 137.5) % 360) * RADIANS,
    lift: 0.06 + ((index * 29) % 100) / 260,
    speed: 0.004 + ((index * 13) % 17) / 3200,
    phase: (index * 0.618) % 1,
    size: 0.6 + ((index * 7) % 5) / 5,
  }));

  constructor(
    private readonly context: CanvasRenderingContext2D,
    dots: readonly GeoPoint[],
  ) {
    this.dots = dots;
    this.dotVectors = new Float32Array(dots.length * 3);
    dots.forEach((dot, index) => this.dotVectors.set(toVector(dot), index * 3));
    this.heat = new Float32Array(dots.length);
    this.lights = new Float32Array(dots.length);
  }

  /** New routes are stamped with `now` so they draw in; routes no longer on the tape are forgotten. */
  setPalette(palette: GlobePalette): void {
    this.palette = palette;
  }

  setScene(scene: GlobeScene, now: number): void {
    const live = new Set(scene.routes.map((route) => route.id));
    for (const id of this.routeBirth.keys()) if (!live.has(id)) this.routeBirth.delete(id);
    for (const route of scene.routes) if (!this.routeBirth.has(route.id)) this.routeBirth.set(route.id, now);
    this.scene = scene;
    this.heat = this.proximity(scene.holds, HOLD_GLOW_DEGREES);
    this.lights = this.proximity([...scene.markers.map((marker) => marker.point), ...scene.nodes], LIGHTS_DEGREES);
  }

  /** 1 at a centre, falling to 0 at `radiusDegrees`: dot products first, an arc-cosine only when close. */
  private proximity(centres: readonly GeoPoint[], radiusDegrees: number): Float32Array {
    const result = new Float32Array(this.dots.length);
    if (centres.length === 0) return result;
    const threshold = Math.cos(radiusDegrees * RADIANS);
    const centreVectors = centres.map(toVector);
    const vectors = this.dotVectors;
    for (let index = 0; index < this.dots.length; index += 1) {
      const x = vectors[index * 3] ?? 0;
      const y = vectors[index * 3 + 1] ?? 0;
      const z = vectors[index * 3 + 2] ?? 0;
      let best = -1;
      for (const [cx, cy, cz] of centreVectors) best = Math.max(best, x * cx + y * cy + z * cz);
      if (best > threshold) result[index] = 1 - Math.acos(Math.min(1, best)) / RADIANS / radiusDegrees;
    }
    return result;
  }

  /** Renders one frame; returns where each marker landed, for the HTML callouts. */
  render(view: GlobeView, width: number, height: number, timeMs: number): ReadonlyMap<string, ScreenPosition> {
    const radius = Math.min(width, height) * 0.42 * view.zoom;
    const cx = width / 2;
    const cy = height / 2;
    const cosLon = Math.cos(view.centerLongitude * RADIANS);
    const sinLon = Math.sin(view.centerLongitude * RADIANS);
    const cosLat = Math.cos(view.centerLatitude * RADIANS);
    const sinLat = Math.sin(view.centerLatitude * RADIANS);

    const project: Projector = (x, y, z, lift = 0) => {
      const x1 = x * cosLon + y * sinLon;
      const y1 = -x * sinLon + y * cosLon;
      const depth = x1 * cosLat + z * sinLat;
      const up = z * cosLat - x1 * sinLat;
      const scale = radius * (1 + lift);
      const sx = cx + scale * y1;
      const sy = cy - scale * up;
      const outside = Math.hypot(sx - cx, sy - cy) > radius;
      return { x: sx, y: sy, depth, visible: depth > 0 || (lift > 0 && outside) };
    };

    this.context.clearRect(0, 0, width, height);
    this.drawAtmosphere(cx, cy, radius, width, height);
    this.drawOrbitals(project, timeMs, false);
    this.drawBody(cx, cy, radius);
    this.drawDots(project, radius, timeMs);
    this.drawRim(cx, cy, radius);
    for (const route of this.scene.routes) this.drawRoute(route, project, timeMs);
    this.drawNodes(project);
    for (const hold of this.scene.holds) this.drawInterventionRing(hold, project, timeMs);
    const positions = this.drawMarkers(project, timeMs);
    this.drawOrbitals(project, timeMs, true);
    return positions;
  }

  private drawAtmosphere(cx: number, cy: number, radius: number, width: number, height: number): void {
    const outer = Math.min(radius * 1.45, Math.min(width, height) / 2);
    const halo = this.context.createRadialGradient(cx, cy, radius * 0.92, cx, cy, outer);
    const { halo: haloColor, glowStrength } = this.palette;
    halo.addColorStop(0, withAlpha(haloColor, 0.5 * glowStrength));
    halo.addColorStop(0.3, withAlpha(haloColor, 0.16 * glowStrength));
    halo.addColorStop(1, withAlpha(haloColor, 0));
    this.context.fillStyle = halo;
    this.context.fillRect(0, 0, width, height);
  }

  private drawBody(cx: number, cy: number, radius: number): void {
    const body = this.context.createRadialGradient(cx - radius * 0.3, cy - radius * 0.35, radius * 0.05, cx, cy, radius);
    const [light, mid, deep] = this.palette.ocean;
    body.addColorStop(0, light);
    body.addColorStop(0.55, mid);
    body.addColorStop(1, deep);
    this.context.beginPath();
    this.context.arc(cx, cy, radius, 0, Math.PI * 2);
    this.context.fillStyle = body;
    this.context.fill();
  }

  private drawRim(cx: number, cy: number, radius: number): void {
    const context = this.context;
    const rim = context.createRadialGradient(cx, cy, radius * 0.8, cx, cy, radius);
    rim.addColorStop(0, withAlpha(this.palette.rim, 0));
    rim.addColorStop(1, withAlpha(this.palette.rim, 0.28 * this.palette.glowStrength));
    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.fillStyle = rim;
    context.fill();
    context.lineWidth = 1.2;
    context.strokeStyle = withAlpha(this.palette.rimStroke, 0.55);
    context.stroke();
  }

  private drawDots(project: Projector, radius: number, timeMs: number): void {
    const context = this.context;
    const base = Math.max(1, radius / 200);
    const vectors = this.dotVectors;
    const palette = this.palette;
    for (let index = 0; index < this.dots.length; index += 1) {
      const point = project(vectors[index * 3] ?? 0, vectors[index * 3 + 1] ?? 0, vectors[index * 3 + 2] ?? 0);
      if (point.depth <= 0) continue;
      const heat = this.heat[index] ?? 0;
      const light = this.lights[index] ?? 0;
      const twinkle = index % 13 === 0 ? 0.18 * Math.sin(timeMs / 1100 + index) : 0;
      context.globalAlpha = Math.min(1, 0.26 + 0.62 * point.depth + twinkle + heat * 0.45 + light * 0.35);
      context.fillStyle = heat > 0.05 ? palette.landHot : light > 0.3 ? palette.landBright : light > 0.05 ? palette.landLit : palette.land;
      const size = base * (0.7 + 0.5 * point.depth) * (1 + heat * 0.7 + light * 0.5);
      context.fillRect(point.x - size / 2, point.y - size / 2, size, size);
    }
    context.globalAlpha = 1;
  }

  /** Faint particles on inclined orbits: drawn in two passes so the globe occludes the far side. */
  private drawOrbitals(project: Projector, timeMs: number, front: boolean): void {
    const context = this.context;
    for (const orbital of this.orbitals) {
      const angle = (orbital.phase + (timeMs / 1000) * orbital.speed) * Math.PI * 2;
      const ox = Math.cos(angle);
      const oy = Math.sin(angle) * Math.cos(orbital.inclination);
      const oz = Math.sin(angle) * Math.sin(orbital.inclination);
      const x = ox * Math.cos(orbital.node) - oy * Math.sin(orbital.node);
      const y = ox * Math.sin(orbital.node) + oy * Math.cos(orbital.node);
      const point = project(x, y, oz, orbital.lift);
      if (point.depth > 0 !== front) continue;
      context.fillStyle = withAlpha(this.palette.particle, front ? 0.55 : 0.18);
      context.fillRect(point.x, point.y, orbital.size, orbital.size);
    }
  }

  private drawRoute(route: GlobeRoute, project: Projector, timeMs: number): void {
    const context = this.context;
    const color = this.palette.tones[route.tone];
    const span = angularDistance(route.from, route.to);
    const lift = 0.06 + (span / 180) * 0.42;
    const born = this.routeBirth.get(route.id) ?? Number.NEGATIVE_INFINITY;
    const growth = Math.min(1, Math.max(0, (timeMs - born) / ROUTE_DRAW_IN_MS));
    const last = Math.max(1, Math.round(ARC_SEGMENTS * growth));
    const points = Array.from({ length: last + 1 }, (_, step) => {
      const t = step / ARC_SEGMENTS;
      const [x, y, z] = slerp(route.from, route.to, t);
      return project(x, y, z, lift * Math.sin(Math.PI * t));
    });

    context.lineWidth = route.tone === 'held' ? 1.8 : 1.2;
    context.strokeStyle = withAlpha(color, route.tone === 'normal' || route.tone === 'accent' ? 0.55 : 0.8);
    context.shadowColor = color;
    context.shadowBlur = 6;
    context.beginPath();
    let drawing = false;
    for (const point of points) {
      if (!point.visible) {
        drawing = false;
        continue;
      }
      if (drawing) context.lineTo(point.x, point.y);
      else context.moveTo(point.x, point.y);
      drawing = true;
    }
    context.stroke();
    context.shadowBlur = 0;

    if (growth < 1) {
      const head = points[points.length - 1];
      if (head?.visible) this.glow(head.x, head.y, 10, color, 1);
      return;
    }
    const period = route.tone === 'held' ? 1_900 : 3_200;
    const phase = ((timeMs + ((route.id.length * 173) % period)) % period) / period;
    for (let trail = 0; trail < 5; trail += 1) {
      const t = phase - trail * 0.018;
      if (t < 0) continue;
      const [x, y, z] = slerp(route.from, route.to, t);
      const point = project(x, y, z, lift * Math.sin(Math.PI * t));
      if (!point.visible) continue;
      this.glow(point.x, point.y, trail === 0 ? 8 : 5 - trail * 0.6, color, 1 - trail * 0.2);
    }
  }

  private drawNodes(project: Projector): void {
    const context = this.context;
    for (const node of this.scene.nodes) {
      const [x, y, z] = toVector(node);
      const point = project(x, y, z);
      if (point.depth <= 0) continue;
      context.fillStyle = withAlpha(this.palette.node, 0.55 + 0.45 * point.depth);
      context.beginPath();
      context.arc(point.x, point.y, 1.8, 0, Math.PI * 2);
      context.fill();
    }
  }

  private drawInterventionRing(hold: GeoPoint, project: Projector, timeMs: number): void {
    const [x, y, z] = toVector(hold);
    const point = project(x, y, z);
    if (point.depth <= 0) return;
    for (const offset of [0, 0.5]) {
      const pulse = (timeMs / 1_600 + offset) % 1;
      this.context.beginPath();
      this.context.arc(point.x, point.y, 8 + pulse * 26, 0, Math.PI * 2);
      this.context.strokeStyle = withAlpha(this.palette.tones.held, 0.75 * (1 - pulse));
      this.context.lineWidth = 2;
      this.context.stroke();
    }
  }

  private drawMarkers(project: Projector, timeMs: number): ReadonlyMap<string, ScreenPosition> {
    const positions = new Map<string, ScreenPosition>();
    const context = this.context;
    for (const marker of this.scene.markers) {
      const [x, y, z] = toVector(marker.point);
      const point = project(x, y, z);
      positions.set(marker.id, { x: point.x, y: point.y, visible: point.depth > 0.08 });
      if (point.depth <= 0) continue;
      const color = this.palette.tones[marker.tone];
      const pulse = (timeMs / 2_200 + marker.id.length * 0.17) % 1;
      context.beginPath();
      context.arc(point.x, point.y, 5 + pulse * 12, 0, Math.PI * 2);
      context.strokeStyle = withAlpha(color, 0.5 * (1 - pulse));
      context.lineWidth = 1.4;
      context.stroke();
      this.glow(point.x, point.y, 14, color, 0.9);
      context.beginPath();
      context.arc(point.x, point.y, 3.2, 0, Math.PI * 2);
      context.fillStyle = this.palette.markerCore;
      context.fill();
    }
    return positions;
  }

  private glow(x: number, y: number, size: number, color: string, alpha: number): void {
    const gradient = this.context.createRadialGradient(x, y, 0, x, y, size);
    gradient.addColorStop(0, withAlpha(color, alpha));
    gradient.addColorStop(0.35, withAlpha(color, alpha * 0.5));
    gradient.addColorStop(1, withAlpha(color, 0));
    this.context.fillStyle = gradient;
    this.context.fillRect(x - size, y - size, size * 2, size * 2);
  }
}
