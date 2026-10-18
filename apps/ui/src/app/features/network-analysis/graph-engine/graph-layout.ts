import type { NodeKind } from '@sentinel/domain';
import type { GraphScene, NodePosition, PositionedGraphScene } from '../models/graph-scene';

const RADIANS = Math.PI / 180;
const FIRST_RING = 270;
const SECOND_RING = 210;
/** Where each kind of direct neighbour sits around the root, in degrees clockwise from east. */
const SECTOR: Readonly<Record<NodeKind, number>> = { DEVICE: -150, PAYEE: -58, ACCOUNT: 42, INSTITUTION: 160 };
const MAX_STEP_DEGREES = 30;
const SECTOR_SPAN_DEGREES = 72;
/** The canvas is wide: the layout is an ellipse, flatter than it is wide. */
const SQUASH_Y = 0.62;

/**
 * A deterministic radial layout: the case account at the centre, its direct neighbours on a ring, grouped by kind
 * into sectors (devices upper left, beneficiaries upper right, receiving accounts right, its own bank lower
 * left), and every further node pushed outward from the neighbour it hangs off. Small graphs (the evidence caps
 * the neighbourhood at 40 nodes) need no physics, and the same scene always lands in the same place.
 */
export function layoutGraph(scene: GraphScene): PositionedGraphScene {
  const positions: Record<string, NodePosition> = {};
  const root = scene.rootId;
  if (!root) return { ...scene, positions };
  positions[root] = { x: 0, y: 0 };

  const neighbours = (id: string) => scene.edges.flatMap((edge) => (edge.from === id ? [edge.to] : edge.to === id ? [edge.from] : []));
  const kindOf = new Map(scene.nodes.map((node) => [node.id, node.kind]));
  const order = new Map(scene.nodes.map((node, index) => [node.id, index]));

  const first = [...new Set(neighbours(root))].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  const byKind = new Map<NodeKind, string[]>();
  for (const id of first) {
    const kind = kindOf.get(id) ?? 'ACCOUNT';
    byKind.set(kind, [...(byKind.get(kind) ?? []), id]);
  }
  for (const [kind, ids] of byKind) {
    const step = Math.min(MAX_STEP_DEGREES, SECTOR_SPAN_DEGREES / Math.max(1, ids.length - 1));
    ids.forEach((id, index) => {
      const angle = (SECTOR[kind] + (index - (ids.length - 1) / 2) * step) * RADIANS;
      // Alternate the radius slightly so labels of neighbouring nodes do not line up.
      const radius = FIRST_RING + (index % 2) * 40;
      positions[id] = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius * SQUASH_Y };
    });
  }

  // Breadth-first outward: each unplaced node hangs off the first placed neighbour, fanned around its direction.
  let frontier = first;
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const parent of frontier) {
      const children = [...new Set(neighbours(parent))].filter((id) => !positions[id]);
      const anchor = positions[parent] ?? { x: 0, y: 0 };
      const base = Math.atan2(anchor.y, anchor.x);
      children.forEach((id, index) => {
        const angle = base + (index - (children.length - 1) / 2) * 22 * RADIANS;
        positions[id] = { x: anchor.x + Math.cos(angle) * SECOND_RING, y: anchor.y + Math.sin(angle) * SECOND_RING * SQUASH_Y };
        next.push(id);
      });
    }
    frontier = next;
  }

  // Anything still unplaced has no path to the root: an outer arc on the left, never hidden.
  const loose = scene.nodes.filter((node) => !positions[node.id]);
  loose.forEach((node, index) => {
    const angle = (180 + (index - (loose.length - 1) / 2) * 18) * RADIANS;
    positions[node.id] = { x: Math.cos(angle) * (FIRST_RING + SECOND_RING), y: Math.sin(angle) * (FIRST_RING + SECOND_RING) };
  });
  return { ...scene, positions };
}
