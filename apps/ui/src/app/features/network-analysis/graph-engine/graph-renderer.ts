import type { PositionedGraphScene } from '../models/graph-scene';

export interface GraphInteractionHandlers {
  readonly nodeSelected: (nodeId: string) => void;
  readonly edgeHovered: (edgeId: string | null) => void;
}

/**
 * The replaceable drawing boundary. SVG or canvas (canvas above 60 nodes); the library is not chosen yet and
 * nothing outside an implementation of this class may import it.
 */
export abstract class GraphRenderer {
  abstract mount(host: HTMLElement, handlers: GraphInteractionHandlers): void;
  abstract render(scene: PositionedGraphScene): void;
  abstract dispose(): void;
}
