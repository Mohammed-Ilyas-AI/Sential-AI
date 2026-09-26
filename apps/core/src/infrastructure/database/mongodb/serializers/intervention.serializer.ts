import type { Intervention } from '@sentinel/domain';
import type { InterventionDocument } from '../collections/interventions.collection.js';

export function toInterventionDocument(intervention: Intervention, ordinal: number): InterventionDocument {
  return { ...intervention, _id: intervention.id, ordinal };
}

export function fromInterventionDocument({ _id, ordinal, ...intervention }: InterventionDocument): Intervention {
  return intervention;
}
