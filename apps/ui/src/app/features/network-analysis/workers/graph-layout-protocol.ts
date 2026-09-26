import type { GraphScene, PositionedGraphScene } from '../models/graph-scene';

export type GraphLayoutWorkerInput = { readonly kind: 'LAYOUT'; readonly scene: GraphScene };

export type GraphLayoutWorkerOutput = { readonly kind: 'POSITIONED'; readonly scene: PositionedGraphScene };
