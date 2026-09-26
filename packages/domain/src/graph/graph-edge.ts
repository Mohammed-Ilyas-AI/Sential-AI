import type { IsoTimestamp } from '../time/iso-timestamp.js';
import type { EdgeEvidence } from './edge-evidence.js';

export type GraphEdgeKind = 'TRANSFERRED_TO' | 'USED_DEVICE' | 'PAYEE_OF' | 'HELD_AT';

export interface GraphEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: GraphEdgeKind;
  /** Total value moved in minor units, or event count. */
  readonly weight: number;
  readonly firstSeen: IsoTimestamp;
  readonly lastSeen: IsoTimestamp;
  readonly evidence: EdgeEvidence;
}
