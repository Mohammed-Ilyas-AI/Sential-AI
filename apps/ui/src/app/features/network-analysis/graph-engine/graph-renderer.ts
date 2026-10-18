import type { GraphEdgeKind, NodeKind } from '@sentinel/domain';
import { ICON_PATHS } from '../../../shared/ui/icon/icon-paths';
import type { GraphSceneEdge, GraphSceneNode, GraphTone, NodePosition, PositionedGraphScene } from '../models/graph-scene';

/** What a click can select. */
export interface GraphTarget {
  readonly kind: 'node' | 'edge';
  readonly id: string;
}

/** Screen = world × scale + offset. */
export interface GraphView {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

export interface GraphPalette {
  readonly text: string;
  readonly textSecondary: string;
  readonly surface: string;
  readonly border: string;
  readonly tones: Readonly<Record<GraphTone, string>>;
}

/** Entity colours: one hue per kind, as in the legend. */
export const KIND_COLOURS: Readonly<Record<NodeKind, string>> = {
  INSTITUTION: '#2f6fe4',
  ACCOUNT: '#e2364b',
  PAYEE: '#16a34a',
  DEVICE: '#7c4ddb',
};

/** Relationship colours and dash patterns, as in the legend. */
export const EDGE_STYLES: Readonly<Record<GraphEdgeKind, { readonly colour: string; readonly dash: readonly number[] }>> = {
  TRANSFERRED_TO: { colour: '#2f6fe4', dash: [] },
  PAYEE_OF: { colour: '#16a34a', dash: [7, 5] },
  USED_DEVICE: { colour: '#7c4ddb', dash: [3, 4] },
  HELD_AT: { colour: '#8a97ab', dash: [1.5, 4] },
};

const GLYPHS: Readonly<Record<NodeKind, string>> = {
  INSTITUTION: ICON_PATHS.bank,
  ACCOUNT: 'M3.5 7h17v11h-17V7Zm0 4h17M7 15h3',
  PAYEE: ICON_PATHS.account,
  DEVICE: 'M8 3h8v18H8V3Zm3 15h2',
};

export const MIN_SCALE = 0.35;
export const MAX_SCALE = 2.6;
const NODE_RADIUS = 22;
const ROOT_RADIUS = 29;
const EDGE_HIT_PX = 7;

function withAlpha(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

/**
 * Draws the entity graph on a 2D canvas and answers hit tests from the same view transform, so a click after
 * any zoom or pan lands on the node under the pointer. Pure drawing: the component owns input and state.
 */
export class CanvasGraphRenderer {
  private scene: PositionedGraphScene | null = null;
  private palette: GraphPalette | null = null;
  private view: GraphView = { scale: 1, offsetX: 0, offsetY: 0 };
  private selection: GraphTarget | null = null;
  private hover: GraphTarget | null = null;
  private highlight: { readonly nodes: ReadonlySet<string>; readonly edges: ReadonlySet<string> } | null = null;
  private readonly glyphs = new Map<NodeKind, Path2D>();

  constructor(private readonly context: CanvasRenderingContext2D) {
    for (const [kind, path] of Object.entries(GLYPHS) as [NodeKind, string][]) this.glyphs.set(kind, new Path2D(path));
  }

  setScene(scene: PositionedGraphScene | null): void {
    this.scene = scene;
  }

  setPalette(palette: GraphPalette): void {
    this.palette = palette;
  }

  setView(view: GraphView): void {
    this.view = view;
  }

  getView(): GraphView {
    return this.view;
  }

  setSelection(selection: GraphTarget | null): void {
    this.selection = selection;
  }

  setHover(hover: GraphTarget | null): void {
    this.hover = hover;
  }

  /** Timeline focus: everything else dims. Null shows the whole graph at full strength. */
  setHighlight(highlight: { readonly nodes: readonly string[]; readonly edges: readonly string[] } | null): void {
    this.highlight = highlight ? { nodes: new Set(highlight.nodes), edges: new Set(highlight.edges) } : null;
  }

  /** The view that frames every node with room for labels, centred in a width × height box. */
  fitView(width: number, height: number): GraphView {
    const positions = Object.values(this.scene?.positions ?? {});
    if (positions.length === 0 || width === 0 || height === 0) return { scale: 1, offsetX: width / 2, offsetY: height / 2 };
    const xs = positions.map((position) => position.x);
    const ys = positions.map((position) => position.y);
    // Labels sit to the right of nodes: more room on that side.
    const left = Math.min(...xs) - 50;
    const right = Math.max(...xs) + 160;
    const top = Math.min(...ys) - 50;
    const bottom = Math.max(...ys) + 50;
    const scale = Math.max(MIN_SCALE, Math.min(1.25, width / (right - left), height / (bottom - top)));
    return { scale, offsetX: width / 2 - ((left + right) / 2) * scale, offsetY: height / 2 - ((top + bottom) / 2) * scale };
  }

  /** The view after zooming by `factor` about the screen point (x, y), clamped to the scale range. */
  zoomedView(factor: number, x: number, y: number): GraphView {
    const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, this.view.scale * factor));
    const ratio = scale / this.view.scale;
    return { scale, offsetX: x - (x - this.view.offsetX) * ratio, offsetY: y - (y - this.view.offsetY) * ratio };
  }

  screenOf(id: string): NodePosition | null {
    const position = this.scene?.positions[id];
    return position ? { x: position.x * this.view.scale + this.view.offsetX, y: position.y * this.view.scale + this.view.offsetY } : null;
  }

  /** Nodes first (nearest), then edges within a few pixels of their curve. */
  hitTest(x: number, y: number): GraphTarget | null {
    const scene = this.scene;
    if (!scene) return null;
    let best: { id: string; distance: number } | null = null;
    for (const node of scene.nodes) {
      const at = this.screenOf(node.id);
      if (!at) continue;
      const distance = Math.hypot(at.x - x, at.y - y);
      if (distance <= this.radiusOf(node) + 4 && (!best || distance < best.distance)) best = { id: node.id, distance };
    }
    if (best) return { kind: 'node', id: best.id };
    let nearest: { id: string; distance: number } | null = null;
    for (const edge of scene.edges) {
      const points = this.curve(edge);
      if (!points) continue;
      for (const point of points) {
        const distance = Math.hypot(point.x - x, point.y - y);
        if (distance <= EDGE_HIT_PX && (!nearest || distance < nearest.distance)) nearest = { id: edge.id, distance };
      }
    }
    return nearest ? { kind: 'edge', id: nearest.id } : null;
  }

  render(width: number, height: number, timeMs: number): void {
    const context = this.context;
    context.clearRect(0, 0, width, height);
    const scene = this.scene;
    const palette = this.palette;
    if (!scene || !palette) return;
    for (const edge of scene.edges) this.drawEdge(edge, palette, timeMs);
    for (const edge of scene.edges) this.drawEdgeLabel(edge, palette);
    for (const node of scene.nodes) this.drawNode(node, palette, timeMs);
  }

  private radiusOf(node: GraphSceneNode): number {
    return (node.root ? ROOT_RADIUS : NODE_RADIUS) * Math.min(1.25, Math.max(0.75, Math.sqrt(this.view.scale)));
  }

  private dimmed(kind: 'node' | 'edge', id: string): boolean {
    if (!this.highlight) return false;
    return kind === 'node' ? !this.highlight.nodes.has(id) : !this.highlight.edges.has(id);
  }

  /** A gentle curve between the two node rims, so a pair of opposite links never overlap. */
  private curve(edge: GraphSceneEdge): { x: number; y: number }[] | null {
    const scene = this.scene;
    const from = this.screenOf(edge.from);
    const to = this.screenOf(edge.to);
    if (!scene || !from || !to) return null;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const bend = edge.kind === 'TRANSFERRED_TO' ? 0.06 : 0.12;
    const control = { x: (from.x + to.x) / 2 - (dy / length) * length * bend, y: (from.y + to.y) / 2 + (dx / length) * length * bend };
    const fromNode = scene.nodes.find((node) => node.id === edge.from);
    const toNode = scene.nodes.find((node) => node.id === edge.to);
    const start = fromNode ? this.radiusOf(fromNode) / length : 0;
    const end = toNode ? 1 - (this.radiusOf(toNode) + 3) / length : 1;
    const points: { x: number; y: number }[] = [];
    for (let step = 0; step <= 24; step += 1) {
      const t = start + ((end - start) * step) / 24;
      const u = 1 - t;
      points.push({ x: u * u * from.x + 2 * u * t * control.x + t * t * to.x, y: u * u * from.y + 2 * u * t * control.y + t * t * to.y });
    }
    return points;
  }

  private edgeColour(edge: GraphSceneEdge, palette: GraphPalette): string {
    if (edge.kind === 'TRANSFERRED_TO' && (edge.tone === 'held' || edge.tone === 'high' || edge.tone === 'elevated')) return palette.tones[edge.tone];
    return EDGE_STYLES[edge.kind].colour;
  }

  private drawEdge(edge: GraphSceneEdge, palette: GraphPalette, timeMs: number): void {
    const points = this.curve(edge);
    if (!points || points.length < 2) return;
    const context = this.context;
    const candidate = edge.evidence.scoring === 'CANDIDATE' || edge.evidence.scoring === 'NONE' || edge.evidence.linkage === 'UNOBSERVED';
    const selected = this.selection?.kind === 'edge' && this.selection.id === edge.id;
    const hovered = this.hover?.kind === 'edge' && this.hover.id === edge.id;
    const alpha = this.dimmed('edge', edge.id) ? 0.14 : candidate ? 0.45 : 0.9;
    const colour = this.edgeColour(edge, palette);
    context.save();
    context.strokeStyle = withAlpha(colour, alpha);
    context.lineWidth = (edge.kind === 'TRANSFERRED_TO' ? 2 : 1.5) + (selected ? 1.6 : hovered ? 0.8 : 0);
    context.setLineDash(candidate ? [8, 6] : [...EDGE_STYLES[edge.kind].dash]);
    context.beginPath();
    points.forEach((point, index) => (index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y)));
    context.stroke();
    context.setLineDash([]);
    // Direction: an arrowhead at the target end.
    const tip = points[points.length - 1];
    const before = points[points.length - 3];
    if (tip && before) {
      const angle = Math.atan2(tip.y - before.y, tip.x - before.x);
      context.fillStyle = withAlpha(colour, alpha);
      context.beginPath();
      context.moveTo(tip.x, tip.y);
      context.lineTo(tip.x - 9 * Math.cos(angle - 0.4), tip.y - 9 * Math.sin(angle - 0.4));
      context.lineTo(tip.x - 9 * Math.cos(angle + 0.4), tip.y - 9 * Math.sin(angle + 0.4));
      context.closePath();
      context.fill();
    }
    // Money in motion: a soft pulse travels along each confirmed transfer.
    if (edge.kind === 'TRANSFERRED_TO' && !candidate && !this.dimmed('edge', edge.id)) {
      const phase = ((timeMs / 2600 + (edge.id.length % 7) / 7) % 1) * (points.length - 1);
      const point = points[Math.floor(phase)];
      if (point) {
        const glow = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, 7);
        glow.addColorStop(0, withAlpha(colour, 0.95));
        glow.addColorStop(1, withAlpha(colour, 0));
        context.fillStyle = glow;
        context.fillRect(point.x - 7, point.y - 7, 14, 14);
      }
    }
    context.restore();
  }

  private drawEdgeLabel(edge: GraphSceneEdge, palette: GraphPalette): void {
    if (this.view.scale < 0.5 || edge.kind === 'HELD_AT' || this.dimmed('edge', edge.id)) return;
    // Only transfers are labelled by default; any other link shows its label when selected, hovered or in focus.
    const focused = this.selection?.id === edge.id || this.hover?.id === edge.id || this.highlight?.edges.has(edge.id);
    if (edge.kind !== 'TRANSFERRED_TO' && !focused) return;
    const points = this.curve(edge);
    const middle = points?.[Math.floor(points.length / 2)];
    if (!middle) return;
    const context = this.context;
    context.font = '600 11px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    const width = context.measureText(edge.label).width + 12;
    context.fillStyle = withAlpha(palette.surface, 0.9);
    context.beginPath();
    context.roundRect(middle.x - width / 2, middle.y - 9, width, 18, 9);
    context.fill();
    context.fillStyle = this.edgeColour(edge, palette);
    context.fillText(edge.label, middle.x, middle.y + 0.5);
  }

  private drawNode(node: GraphSceneNode, palette: GraphPalette, timeMs: number): void {
    const at = this.screenOf(node.id);
    if (!at) return;
    const context = this.context;
    const radius = this.radiusOf(node);
    const colour = KIND_COLOURS[node.kind];
    const dim = this.dimmed('node', node.id);
    const selected = this.selection?.kind === 'node' && this.selection.id === node.id;
    const hovered = this.hover?.kind === 'node' && this.hover.id === node.id;
    context.save();
    context.globalAlpha = dim ? 0.25 : 1;

    // Halo, white disc with the kind ring, coloured core with the glyph.
    const halo = context.createRadialGradient(at.x, at.y, radius * 0.6, at.x, at.y, radius * 1.9);
    halo.addColorStop(0, withAlpha(colour, node.root ? 0.35 : 0.22));
    halo.addColorStop(1, withAlpha(colour, 0));
    context.fillStyle = halo;
    context.beginPath();
    context.arc(at.x, at.y, radius * 1.9, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = palette.surface;
    context.beginPath();
    context.arc(at.x, at.y, radius, 0, Math.PI * 2);
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = withAlpha(colour, 0.55);
    if (node.unobserved) context.setLineDash([4, 3]);
    context.stroke();
    context.setLineDash([]);
    const core = context.createRadialGradient(at.x - radius * 0.3, at.y - radius * 0.3, 1, at.x, at.y, radius * 0.78);
    core.addColorStop(0, withAlpha(colour, 0.75));
    core.addColorStop(1, colour);
    context.fillStyle = core;
    context.beginPath();
    context.arc(at.x, at.y, radius * 0.74, 0, Math.PI * 2);
    context.fill();
    const glyph = this.glyphs.get(node.kind);
    if (glyph) {
      const size = radius * 0.9;
      context.save();
      context.translate(at.x - size / 2, at.y - size / 2);
      context.scale(size / 24, size / 24);
      context.strokeStyle = '#ffffff';
      context.lineWidth = 2;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.stroke(glyph);
      context.restore();
    }

    // Risk ring for the gate's own outcome, and the persistent flag mark.
    if (node.tone === 'held' || node.tone === 'high' || node.tone === 'elevated') {
      context.beginPath();
      context.arc(at.x, at.y, radius + 4, 0, Math.PI * 2);
      context.lineWidth = 2.5;
      context.strokeStyle = withAlpha(palette.tones[node.tone], 0.9);
      context.stroke();
    }
    if (node.flagged) {
      const bx = at.x + radius * 0.72;
      const by = at.y - radius * 0.72;
      context.beginPath();
      context.arc(bx, by, 7.5, 0, Math.PI * 2);
      context.fillStyle = node.tone === 'elevated' ? palette.tones.elevated : palette.tones.held;
      context.fill();
      context.lineWidth = 1.5;
      context.strokeStyle = palette.surface;
      context.stroke();
      context.fillStyle = '#ffffff';
      context.font = '800 10px system-ui, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('!', bx, by + 0.5);
    }
    if (selected || hovered) {
      context.beginPath();
      context.arc(at.x, at.y, radius + (selected ? 9 + ((timeMs / 900) % 1) * 4 : 7), 0, Math.PI * 2);
      context.lineWidth = selected ? 2.2 : 1.4;
      context.strokeStyle = withAlpha('#2f6fe4', selected ? 0.9 : 0.5);
      context.stroke();
    }

    // Label and caption to the right.
    if (this.view.scale >= 0.38 || node.root || selected) {
      const x = at.x + radius + 10;
      context.textAlign = 'left';
      context.textBaseline = 'alphabetic';
      context.font = `700 ${node.root ? 13 : 12}px system-ui, sans-serif`;
      const label = node.label.length > 22 ? `${node.label.slice(0, 21)}…` : node.label;
      context.lineWidth = 4;
      context.strokeStyle = withAlpha(palette.surface, 0.85);
      context.strokeText(label, x, at.y - 1);
      context.fillStyle = palette.text;
      context.fillText(label, x, at.y - 1);
      context.font = '500 11px system-ui, sans-serif';
      context.strokeText(node.caption, x, at.y + 14);
      context.fillStyle = palette.textSecondary;
      context.fillText(node.caption, x, at.y + 14);
      if (node.root && node.tone === 'held') {
        const chipX = x + Math.max(context.measureText(node.caption).width, 60) + 8;
        context.font = '800 10px system-ui, sans-serif';
        const text = 'HOLD';
        const chipWidth = context.measureText(text).width + 14;
        context.fillStyle = withAlpha(palette.tones.held, 0.14);
        context.beginPath();
        context.roundRect(chipX, at.y - 16, chipWidth, 18, 5);
        context.fill();
        context.strokeStyle = withAlpha(palette.tones.held, 0.6);
        context.lineWidth = 1;
        context.stroke();
        context.fillStyle = palette.tones.held;
        context.fillText(text, chipX + 7, at.y - 3);
      }
    }
    context.restore();
  }
}
