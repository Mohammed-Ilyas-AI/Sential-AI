/// <reference lib="webworker" />
import type { GraphLayoutWorkerInput } from './graph-layout-protocol';

/** Layout simulation off the main thread. Build order step 11, once the graph library is chosen. */
addEventListener('message', (event: MessageEvent<GraphLayoutWorkerInput>) => {
  void event;
});
