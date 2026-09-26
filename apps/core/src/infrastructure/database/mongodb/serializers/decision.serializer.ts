import type { DecisionRecord } from '@sentinel/domain';
import type { DecisionDocument } from '../collections/decisions.collection.js';

export function toDecisionDocument(decision: DecisionRecord): DecisionDocument {
  return { ...decision, _id: decision.decisionId };
}

export function fromDecisionDocument({ _id, ...decision }: DecisionDocument): DecisionRecord {
  return decision;
}
