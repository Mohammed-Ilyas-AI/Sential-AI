import type { Intervention } from '@sentinel/domain';
import type { InterventionDocument } from '../collections/interventions.collection.js';

export function toInterventionDocument(intervention: Intervention): InterventionDocument {
  return { ...intervention, _id: intervention.id };
}

export function fromInterventionDocument({ _id, ...intervention }: InterventionDocument): Intervention {
  return intervention;
}
