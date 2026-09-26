import { describe, expect, it } from 'vitest';
import { normaliseChange } from './stream-message.normalizer.js';

describe('normaliseChange', () => {
  it('turns a committed decision into a DECISION message without storage fields', () => {
    const message = normaliseChange(
      { collection: 'decisions', document: { _id: 'dec-1', decisionId: 'dec-1', decision: 'HOLD', riskScore: 95 }, cursor: 'c-1' },
      '2026-09-24T11:30:45.100Z',
    );
    expect(message).toEqual({
      kind: 'DECISION',
      cursor: 'c-1',
      emittedAt: '2026-09-24T11:30:45.100Z',
      payload: { decisionId: 'dec-1', decision: 'HOLD', riskScore: 95 },
    });
  });

  it('maps alerts and interventions, dropping the intervention ordinal', () => {
    expect(normaliseChange({ collection: 'alerts', document: { _id: 'a', id: 'a' }, cursor: 'c' }, 't').kind).toBe('ALERT');
    const intervention = normaliseChange({ collection: 'interventions', document: { _id: 'i', id: 'i', ordinal: 0, state: 'HELD' }, cursor: 'c' }, 't');
    expect(intervention).toMatchObject({ kind: 'INTERVENTION', payload: { id: 'i', state: 'HELD' } });
    expect(intervention.payload).not.toHaveProperty('ordinal');
  });
});
