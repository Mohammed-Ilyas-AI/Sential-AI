import { DISTRICT_LABELS, ISLAND_FRAME, MAP_ART, institutionSite, onMap, type ArtPoint } from '../../geo/singapore-map';
import {
  DARK_GLOBE_PALETTE,
  type GlobeHitTarget,
  type GlobePalette,
  type GlobeScene,
  type GlobeTarget,
  type GlobeTargetKind,
  type GlobeTone,
  type GlobeView,
  type ScreenPosition,
} from './globe-renderer';

const ROUTE_DRAW_IN_MS = 1_400;
const ARC_SEGMENTS = 40;
const BANK_HIT_PX = 16;
const NODE_HIT_PX = 9;
const TRANSFER_HIT_PX = 11;
/** Height of a bank badge above its site, in screen pixels at zoom 1. */
const BADGE_LIFT_PX = 26;
/** Drag pixels per degree of the component's orientation: the drag moves the map 1:1 with the pointer. */
const PAN_X_PX_PER_DEGREE = 1 / 0.3;
const PAN_Y_PX_PER_DEGREE = 1 / 0.2;
const START_TILT = 18;
/** At most this much horizontal stretch, so the artwork can span a wide card without looking distorted. */
const MAX_STRETCH = 1.4;
/** The idle sway: a slow, slight turn of the map while animation runs. */
const SWAY_DEGREES = 1.2;
const SWAY_PERIOD_MS = 14_000;
/** Navy used beyond the artwork's edges until the artwork has been sampled. */
const FALLBACK_SEA = '#06142e';

interface PlacedScene {
  readonly markers: readonly { readonly id: string; readonly at: ArtPoint; readonly tone: GlobeTone; readonly label: string }[];
  readonly nodes: readonly { readonly id: string; readonly at: ArtPoint; readonly label: string }[];
  readonly routes: readonly { readonly id: string; readonly from: ArtPoint; readonly to: ArtPoint; readonly tone: GlobeTone; readonly label: string }[];
  readonly holds: readonly ArtPoint[];
}

type Projector = (x: number, y: number, liftPx?: number) => { readonly x: number; readonly y: number };

function withAlpha(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

/**
 * The live network over the Singapore artwork. Two layers: the artwork, a static picture that is never hit-tested,
 * and the live overlay (banks, accounts, transfers, holds) bound to the tape and placed in the artwork's pixel
 * space, so zoom and pan move both together. The interface is the globe renderer's, so the component's input,
 * callouts, selection and hit-testing work unchanged.
 *
 * View: `centerLongitude` and `centerLatitude` are the pan the analyst dragged (0 and 18 are the default framing),
 * `zoom` the scale and `heading` the turn, both about the card's centre. While animation runs the map also sways
 * by a degree or so; pausing freezes it.
 */
export class SingaporeMapRenderer {
  private scene: PlacedScene = { markers: [], nodes: [], routes: [], holds: [] };
  private palette: GlobePalette = DARK_GLOBE_PALETTE;
  private selection: GlobeTarget | null = null;
  private hover: GlobeTarget | null = null;
  private showRoutes = true;
  private showEntityLabels = false;
  private targets: GlobeHitTarget[] = [];
  private readonly routeBirth = new Map<string, number>();
  private readonly art = new Image();
  private artReady = false;
  private sea = FALLBACK_SEA;

  constructor(
    private readonly context: CanvasRenderingContext2D,
    onArtLoaded: () => void,
  ) {
    this.art.decoding = 'async';
    this.art.onload = () => {
      this.artReady = true;
      this.sea = sampleEdge(this.art) ?? FALLBACK_SEA;
      onArtLoaded();
    };
    this.art.src = MAP_ART.src;
  }

  /** Releases the artwork's load handler; the component calls this on destroy. */
  dispose(): void {
    this.art.onload = null;
  }

  setPalette(palette: GlobePalette): void {
    this.palette = palette;
  }

  setSelection(selection: GlobeTarget | null): void {
    this.selection = selection;
  }

  setHover(hover: GlobeTarget | null): void {
    this.hover = hover;
  }

  setDisplayOptions(options: { readonly showRoutes: boolean; readonly showEntityLabels: boolean }): void {
    this.showRoutes = options.showRoutes;
    this.showEntityLabels = options.showEntityLabels;
  }

  /** Every target drawn in the last frame. */
  hitTargets(): readonly GlobeHitTarget[] {
    return this.targets;
  }

  /** The nearest target under (x, y), banks before transfers before accounts when they overlap. */
  hitTest(x: number, y: number): GlobeHitTarget | null {
    const rank: Readonly<Record<GlobeTargetKind, number>> = { bank: 0, transaction: 1, account: 2 };
    let best: GlobeHitTarget | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const target of this.targets) {
      const distance = Math.hypot(target.x - x, target.y - y);
      if (distance > target.radius) continue;
      const score = rank[target.kind] * 1000 + distance;
      if (score < bestScore) {
        best = target;
        bestScore = score;
      }
    }
    return best;
  }

  /** Places the scene on the artwork; new routes are stamped with `now` so they draw in. */
  setScene(scene: GlobeScene, now: number): void {
    const live = new Set(scene.routes.map((route) => route.id));
    for (const id of this.routeBirth.keys()) if (!live.has(id)) this.routeBirth.delete(id);
    for (const route of scene.routes) if (!this.routeBirth.has(route.id)) this.routeBirth.set(route.id, now);
    const banks = scene.markers.map((marker, index) => ({ point: marker.point, site: institutionSite(marker.id, index) }));
    const place = (point: { latitude: number; longitude: number }): ArtPoint => onMap(point, banks);
    this.scene = {
      markers: scene.markers.map((marker, index) => ({
        id: marker.id,
        at: institutionSite(marker.id, index),
        tone: marker.tone,
        label: marker.label ?? marker.id,
      })),
      nodes: scene.nodes.map((node) => ({ id: node.id, at: place(node.point), label: node.label ?? node.id })),
      routes: scene.routes.map((route) => ({ id: route.id, from: place(route.from), to: place(route.to), tone: route.tone, label: route.label ?? route.id })),
      holds: scene.holds.map(place),
    };
  }

  /** Renders one frame; returns where each bank badge landed, for the HTML callouts. */
  render(view: GlobeView, width: number, height: number, timeMs: number): ReadonlyMap<string, ScreenPosition> {
    // A wide card: the island fills the height and the artwork is stretched (within MAX_STRETCH) to span the
    // card from edge to edge, figures over its left side. A narrow card: the island fits the whole card.
    const wide = width >= 900;
    const frameWidth = ISLAND_FRAME.right - ISLAND_FRAME.left;
    const frameHeight = ISLAND_FRAME.bottom - ISLAND_FRAME.top;
    const frameMiddleY = (ISLAND_FRAME.top + ISLAND_FRAME.bottom) / 2;
    const fitY = wide ? (height - 8) / frameHeight : Math.min(width / frameWidth, (height - 12) / frameHeight);
    const fitX = wide ? Math.min(fitY * MAX_STRETCH, Math.max(fitY, width / MAP_ART.width)) : fitY;
    const centreX = wide ? MAP_ART.width / 2 : (ISLAND_FRAME.left + ISLAND_FRAME.right) / 2;
    const scaleX = fitX * view.zoom;
    const scaleY = fitY * view.zoom;
    const panLimitX = width * 0.4 * view.zoom;
    const panLimitY = height * 0.4 * view.zoom;
    const panX = Math.max(-panLimitX, Math.min(panLimitX, -view.centerLongitude * PAN_X_PX_PER_DEGREE));
    const panY = Math.max(-panLimitY, Math.min(panLimitY, (view.centerLatitude - START_TILT) * PAN_Y_PX_PER_DEGREE));
    const anchorX = width / 2 + panX;
    const anchorY = height / 2 + panY;
    const heading = ((view.heading ?? 0) + Math.sin((timeMs / SWAY_PERIOD_MS) * Math.PI * 2) * SWAY_DEGREES) * (Math.PI / 180);
    const cos = Math.cos(heading);
    const sin = Math.sin(heading);
    const lift = Math.sqrt(view.zoom);
    // Artwork pixels to screen: scale about the framing centre, turn by the heading, then pan. Beams and arcs
    // rise straight up the screen whatever the heading.
    const project: Projector = (x, y, liftPx = 0) => {
      const dx = (x - centreX) * scaleX;
      const dy = (y - frameMiddleY) * scaleY;
      return { x: anchorX + dx * cos - dy * sin, y: anchorY + dx * sin + dy * cos - liftPx * lift };
    };

    const context = this.context;
    context.fillStyle = this.sea;
    context.fillRect(0, 0, width, height);
    if (this.artReady) {
      context.save();
      context.translate(anchorX, anchorY);
      context.rotate(heading);
      context.scale(scaleX, scaleY);
      context.translate(-centreX, -frameMiddleY);
      context.drawImage(this.art, 0, 0, MAP_ART.width, MAP_ART.height);
      this.blendEdges();
      context.restore();
    }

    this.targets = [];
    this.drawDistricts(project, wide ? width * 0.27 : 0);
    for (const hold of this.scene.holds) this.drawHold(hold, project, timeMs);
    const focusedRoute = this.selection?.kind === 'transaction' ? this.selection.id : null;
    for (const route of this.scene.routes) this.drawRoute(route, project, timeMs, focusedRoute);
    this.drawNodes(project);
    const positions = this.drawMarkers(project, timeMs);
    this.drawSelection(timeMs);
    return positions;
  }

  /**
   * Softens the artwork's edges into the surrounding sea, so the frame never shows a seam, whatever the heading.
   * Drawn in the artwork's own coordinates, inside its transform.
   */
  private blendEdges(): void {
    const context = this.context;
    const { width, height } = MAP_ART;
    const fade = 140;
    const edges: readonly (readonly [number, number, number, number, number, number, number, number])[] = [
      [0, 0, fade, 0, 0, 0, fade, height],
      [width, 0, width - fade, 0, width - fade, 0, fade, height],
      [0, 0, 0, fade, 0, 0, width, fade],
      [0, height, 0, height - fade, 0, height - fade, width, fade],
    ];
    for (const [x0, y0, x1, y1, rx, ry, rw, rh] of edges) {
      const gradient = context.createLinearGradient(x0, y0, x1, y1);
      gradient.addColorStop(0, this.sea);
      gradient.addColorStop(1, withAlpha(this.sea, 0));
      context.fillStyle = gradient;
      context.fillRect(rx, ry, rw, rh);
    }
  }

  /** Place names, except where the network figures sit over the map. */
  private drawDistricts(project: Projector, hiddenLeftOf: number): void {
    const context = this.context;
    context.font = '600 12px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    for (const district of DISTRICT_LABELS) {
      const at = project(district.at[0], district.at[1]);
      if (at.x < hiddenLeftOf) continue;
      const text = context.measureText(district.label).width;
      context.fillStyle = 'rgba(4, 12, 28, 0.78)';
      context.beginPath();
      context.roundRect(at.x - text / 2 - 8, at.y - 11, text + 16, 22, 6);
      context.fill();
      context.fillStyle = '#ffffff';
      context.fillText(district.label, at.x, at.y + 0.5);
    }
  }

  /** A held destination: warm glow and two expanding rings lying on the ground. */
  private drawHold(at: ArtPoint, project: Projector, timeMs: number): void {
    const point = project(at[0], at[1]);
    this.glow(point.x, point.y, 30, this.palette.landHot, 0.45);
    for (const offset of [0, 0.5]) {
      const pulse = (timeMs / 1_600 + offset) % 1;
      const radius = 8 + pulse * 26;
      this.context.beginPath();
      this.context.ellipse(point.x, point.y, radius, radius * 0.5, 0, 0, Math.PI * 2);
      this.context.strokeStyle = withAlpha(this.palette.tones.held, 0.85 * (1 - pulse));
      this.context.lineWidth = 2;
      this.context.stroke();
    }
  }

  private drawRoute(route: PlacedScene['routes'][number], project: Projector, timeMs: number, focused: string | null): void {
    const context = this.context;
    const color = this.palette.tones[route.tone];
    const selected = focused === route.id;
    const dimmed = focused !== null && !selected;
    const start = project(route.from[0], route.from[1]);
    const end = project(route.to[0], route.to[1]);
    const span = Math.hypot(end.x - start.x, end.y - start.y);
    const height = 10 + span * 0.22;
    const at = (t: number) => project(route.from[0] + (route.to[0] - route.from[0]) * t, route.from[1] + (route.to[1] - route.from[1]) * t, height * Math.sin(Math.PI * t));
    const born = this.routeBirth.get(route.id) ?? Number.NEGATIVE_INFINITY;
    const growth = Math.min(1, Math.max(0, (timeMs - born) / ROUTE_DRAW_IN_MS));
    const last = Math.max(1, Math.round(ARC_SEGMENTS * growth));

    if (this.showRoutes) {
      context.lineWidth = selected ? 3 : route.tone === 'held' ? 2.2 : 1.6;
      const baseAlpha = route.tone === 'normal' || route.tone === 'accent' ? 0.7 : 0.9;
      context.strokeStyle = withAlpha(color, selected ? 1 : dimmed ? baseAlpha * 0.3 : baseAlpha);
      context.shadowColor = color;
      context.shadowBlur = 10;
      context.beginPath();
      for (let step = 0; step <= last; step += 1) {
        const point = at(step / ARC_SEGMENTS);
        if (step === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      }
      context.stroke();
      context.shadowBlur = 0;
    }

    if (growth >= 1) {
      // Risky transfers carry an alert pin at the top of their arc; the rest a small dot. Either selects it.
      const apex = at(0.5);
      if (route.tone === 'normal' || route.tone === 'accent') {
        context.beginPath();
        context.arc(apex.x, apex.y, selected ? 4.5 : 3, 0, Math.PI * 2);
        context.fillStyle = withAlpha(color, dimmed ? 0.4 : 0.95);
        context.fill();
      } else {
        this.drawAlertPin(apex.x, apex.y, color, dimmed ? 0.45 : 1);
      }
      this.targets.push({ kind: 'transaction', id: route.id, x: apex.x, y: apex.y, radius: TRANSFER_HIT_PX, label: route.label });
    }
    if (!this.showRoutes) return;
    if (growth < 1) {
      const head = at(last / ARC_SEGMENTS);
      this.glow(head.x, head.y, 10, color, 1);
      return;
    }
    const period = route.tone === 'held' ? 1_900 : 3_200;
    const phase = ((timeMs + ((route.id.length * 173) % period)) % period) / period;
    for (let trail = 0; trail < 5; trail += 1) {
      const t = phase - trail * 0.02;
      if (t < 0) continue;
      const point = at(t);
      this.glow(point.x, point.y, trail === 0 ? 8 : 5 - trail * 0.6, color, 1 - trail * 0.2);
    }
  }

  /** A round pin in the route's tone with a warning triangle. */
  private drawAlertPin(x: number, y: number, color: string, alpha: number): void {
    const context = this.context;
    this.glow(x, y, 18, color, 0.6 * alpha);
    context.beginPath();
    context.arc(x, y, 9, 0, Math.PI * 2);
    context.fillStyle = withAlpha(color, alpha);
    context.fill();
    context.lineWidth = 1.4;
    context.strokeStyle = withAlpha(this.palette.markerCore, 0.85 * alpha);
    context.stroke();
    context.beginPath();
    context.moveTo(x, y - 5);
    context.lineTo(x + 5, y + 3.6);
    context.lineTo(x - 5, y + 3.6);
    context.closePath();
    context.fillStyle = withAlpha(this.palette.markerCore, alpha);
    context.fill();
    context.fillStyle = withAlpha(color, alpha);
    context.fillRect(x - 0.7, y - 2, 1.4, 3);
  }

  private drawNodes(project: Projector): void {
    const context = this.context;
    for (const node of this.scene.nodes) {
      const point = project(node.at[0], node.at[1], 2);
      const active = this.hover?.id === node.id || this.selection?.id === node.id;
      this.glow(point.x, point.y, 8, this.palette.node, 0.55);
      context.fillStyle = withAlpha(this.palette.node, 0.95);
      context.beginPath();
      context.arc(point.x, point.y, active ? 3.6 : 2.6, 0, Math.PI * 2);
      context.fill();
      if (this.showEntityLabels) this.drawEntityLabel(node.label, point.x, point.y + 14);
      this.targets.push({ kind: 'account', id: node.id, x: point.x, y: point.y, radius: NODE_HIT_PX, label: node.label });
    }
  }

  /** A bank: a light beam from its site up to a badge, a ground pulse, and the badge with its bank glyph. */
  private drawMarkers(project: Projector, timeMs: number): ReadonlyMap<string, ScreenPosition> {
    const positions = new Map<string, ScreenPosition>();
    const context = this.context;
    for (const marker of this.scene.markers) {
      const ground = project(marker.at[0], marker.at[1]);
      const badge = project(marker.at[0], marker.at[1], BADGE_LIFT_PX);
      const color = this.palette.tones[marker.tone];
      positions.set(marker.id, { x: badge.x, y: badge.y, visible: true });
      const pulse = (timeMs / 2_200 + marker.id.length * 0.17) % 1;
      context.beginPath();
      context.ellipse(ground.x, ground.y, 6 + pulse * 20, (6 + pulse * 20) * 0.5, 0, 0, Math.PI * 2);
      context.strokeStyle = withAlpha(color, 0.75 * (1 - pulse));
      context.lineWidth = 1.6;
      context.stroke();
      const beam = context.createLinearGradient(0, ground.y, 0, badge.y);
      beam.addColorStop(0, withAlpha(color, 0.95));
      beam.addColorStop(1, withAlpha(color, 0.15));
      context.strokeStyle = beam;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(ground.x, ground.y);
      context.lineTo(badge.x, badge.y);
      context.stroke();
      this.glow(badge.x, badge.y, 26, color, 0.75);
      context.beginPath();
      context.arc(badge.x, badge.y, 12, 0, Math.PI * 2);
      context.fillStyle = color;
      context.fill();
      context.lineWidth = 1.8;
      context.strokeStyle = withAlpha(this.palette.markerCore, 0.9);
      context.stroke();
      this.drawBankGlyph(badge.x, badge.y);
      if (this.showEntityLabels) this.drawEntityLabel(marker.label, badge.x, badge.y + 24);
      this.targets.push({ kind: 'bank', id: marker.id, x: badge.x, y: badge.y, radius: BANK_HIT_PX, label: marker.label });
    }
    return positions;
  }

  /** A small classical bank front: roof, three columns, step. */
  private drawBankGlyph(x: number, y: number): void {
    const context = this.context;
    context.fillStyle = this.palette.markerCore;
    context.beginPath();
    context.moveTo(x - 6.5, y - 2);
    context.lineTo(x, y - 7);
    context.lineTo(x + 6.5, y - 2);
    context.closePath();
    context.fill();
    for (const column of [-4.5, -0.75, 3]) context.fillRect(x + column, y - 1, 1.5, 5.5);
    context.fillRect(x - 6.5, y + 5, 13, 1.6);
  }

  private drawEntityLabel(label: string, x: number, y: number): void {
    const context = this.context;
    context.font = '600 11px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineWidth = 3;
    context.strokeStyle = 'rgba(4, 12, 28, 0.9)';
    context.strokeText(label, x, y);
    context.fillStyle = '#ffffff';
    context.fillText(label, x, y);
  }

  private drawSelection(timeMs: number): void {
    const context = this.context;
    for (const [target, strong] of [
      [this.hover, false],
      [this.selection, true],
    ] as const) {
      if (!target) continue;
      const hit = this.targets.find((candidate) => candidate.kind === target.kind && candidate.id === target.id);
      if (!hit) continue;
      const base = hit.kind === 'bank' ? 16 : 11;
      context.beginPath();
      context.arc(hit.x, hit.y, base, 0, Math.PI * 2);
      context.lineWidth = strong ? 2.2 : 1.2;
      context.strokeStyle = strong ? '#ffffff' : 'rgba(255, 255, 255, 0.6)';
      context.stroke();
      if (!strong) continue;
      const pulse = (timeMs / 1_800) % 1;
      context.beginPath();
      context.arc(hit.x, hit.y, base + 4 + pulse * 10, 0, Math.PI * 2);
      context.lineWidth = 1.4;
      context.strokeStyle = withAlpha(this.palette.tones.accent, 0.7 * (1 - pulse));
      context.stroke();
    }
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

/** The artwork's mean edge colour, so the area beyond it continues the same sea. */
function sampleEdge(image: HTMLImageElement): string | null {
  const probe = document.createElement('canvas');
  probe.width = 64;
  probe.height = 36;
  const context = probe.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, 64, 36);
  const { data } = context.getImageData(0, 0, 64, 36);
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;
  for (let y = 0; y < 36; y += 1) {
    for (let x = 0; x < 64; x += 1) {
      if (x > 2 && x < 61 && y > 2 && y < 33) continue;
      const index = (y * 64 + x) * 4;
      red += data[index] ?? 0;
      green += data[index + 1] ?? 0;
      blue += data[index + 2] ?? 0;
      count += 1;
    }
  }
  const hex = (value: number) => Math.round(value / count).toString(16).padStart(2, '0');
  return `#${hex(red)}${hex(green)}${hex(blue)}`;
}
