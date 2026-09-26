import type { EdgeLinkage, GraphEdge } from '@sentinel/domain';
import { LINKAGE_SCORING } from '@sentinel/domain';
import { describe, expect, it } from 'vitest';
import { flaggedLinksWithinTwoHops } from './flagged-links.js';

const edge = (from: string, to: string, linkage: EdgeLinkage): GraphEdge => ({
  from,
  to,
  kind: 'TRANSFERRED_TO',
  weight: 1,
  firstSeen: '2026-09-24T09:30:00.000Z',
  lastSeen: '2026-09-24T09:30:00.000Z',
  evidence: {
    sourceInstitution: 'BANK_B',
    evidenceType: 'PAYMENT_EVENT',
    observedAt: '2026-09-24T09:30:00.000Z',
    tenantScope: 'NETWORK',
    linkage,
    scoring: LINKAGE_SCORING[linkage],
  },
});

describe('flaggedLinksWithinTwoHops', () => {
  it('reports one linkage per flagged neighbour, strongest first', () => {
    const links = flaggedLinksWithinTwoHops(
      'root',
      [edge('root', 'a', 'NETWORK_TOKEN'), edge('b', 'root', 'NETWORK_REFERENCE'), edge('root', 'c', 'CORRELATED')],
      new Set(['a', 'b', 'c']),
    );
    expect(links).toEqual(['NETWORK_REFERENCE', 'NETWORK_TOKEN', 'CORRELATED']);
  });

  it('reaches two hops at the strength of the weakest edge on the path', () => {
    const links = flaggedLinksWithinTwoHops('root', [edge('root', 'hop1', 'DIRECT'), edge('hop1', 'hop2', 'NETWORK_TOKEN')], new Set(['hop2']));
    expect(links).toEqual(['NETWORK_TOKEN']);
  });

  it('keeps the strongest path when several reach the same entity', () => {
    const links = flaggedLinksWithinTwoHops(
      'root',
      [edge('root', 'x', 'CORRELATED'), edge('root', 'hop1', 'DIRECT'), edge('hop1', 'x', 'NETWORK_REFERENCE')],
      new Set(['x']),
    );
    expect(links).toEqual(['NETWORK_REFERENCE']);
  });

  it('ignores unflagged entities, the root itself and anything three hops away', () => {
    const links = flaggedLinksWithinTwoHops(
      'root',
      [edge('root', 'a', 'DIRECT'), edge('a', 'b', 'DIRECT'), edge('b', 'c', 'DIRECT'), edge('a', 'root', 'DIRECT')],
      new Set(['root', 'c']),
    );
    expect(links).toEqual([]);
  });
});
