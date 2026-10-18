import type { EvidenceBundle } from '@sentinel/domain';
import { describe, expect, it } from 'vitest';
import { demoFinalDecision, demoHold } from '../../../../testing/ui-fixtures';
import { buildEvidenceGraph } from './evidence-graph';
import { layoutGraph } from './graph-layout';

const decision = demoFinalDecision();
const evidence = (overrides: Partial<EvidenceBundle> = {}): EvidenceBundle => ({
  account: { accountId: decision.accountId, institutionId: 'BANK_A', openedAt: '2019-03-01T00:00:00.000Z', protected: true },
  assessment: decision.assessment,
  drain: decision.assessment.drain,
  recentTransactions: [
    {
      id: decision.transactionId,
      ts: decision.occurredAt,
      sourceAccountId: decision.accountId,
      destAccountId: 'acct_tok_mule',
      payeeId: 'ben_tok_mule',
      deviceId: 'dev_tok_new',
      amount: decision.amount,
      channel: 'APP',
      type: 'TRANSFER',
      institutionId: 'BANK_A',
      destInstitutionId: 'BANK_C',
    },
  ],
  deviceHistory: [{ deviceId: 'dev_tok_new', eventType: 'NEW_DEVICE', occurredAt: '2026-09-24T00:58:00.000Z' }],
  payeeHistory: [{ payeeId: 'ben_tok_mule', eventType: 'PAYEE_ADDED', occurredAt: '2026-09-24T00:58:30.000Z' }],
  priorAlerts: [],
  interventions: [demoHold()],
  neighbourhood: { rootId: decision.accountId, hopDepth: 2, nodes: [], edges: [], truncated: false },
  ...overrides,
});

describe('buildEvidenceGraph', () => {
  it('draws only what the records establish, each edge with its own evidence', () => {
    const { scene } = buildEvidenceGraph(evidence(), new Map(), 'ACC-10291');
    expect(scene.rootId).toBe(decision.accountId);
    expect(scene.nodes.map((node) => [node.id, node.kind]).sort()).toEqual(
      [
        [decision.accountId, 'ACCOUNT'],
        ['acct_tok_mule', 'ACCOUNT'],
        ['ben_tok_mule', 'PAYEE'],
        ['dev_tok_new', 'DEVICE'],
        ['inst:BANK_A', 'INSTITUTION'],
        ['inst:BANK_C', 'INSTITUTION'],
      ].sort(),
    );
    const transfer = scene.edges.find((edge) => edge.kind === 'TRANSFERRED_TO');
    expect(transfer).toMatchObject({ from: decision.accountId, to: 'acct_tok_mule', transfers: [decision.transactionId], weight: decision.amount });
    expect(transfer?.evidence).toMatchObject({ linkage: 'DIRECT', scoring: 'CONFIRMED', tenantScope: 'OWN' });
    expect(scene.nodes.find((node) => node.id === 'dev_tok_new')?.flags).toEqual(['new device']);
    expect(scene.nodes.find((node) => node.id === 'ben_tok_mule')?.flags).toEqual(['new payee']);
  });

  it('keeps the policy decision and the intervention state as separate facts on the transfer', () => {
    const { scene } = buildEvidenceGraph(evidence(), new Map(), null);
    expect(scene.transfers[0]).toMatchObject({ id: decision.transactionId, intervention: 'HELD' });
    expect(scene.edges.find((edge) => edge.kind === 'TRANSFERRED_TO')?.tone).toBe('held');
  });

  it('draws a core candidate link as a candidate, with an unobserved end it cannot resolve', () => {
    const { scene } = buildEvidenceGraph(
      evidence({
        neighbourhood: {
          rootId: decision.accountId,
          hopDepth: 2,
          nodes: [],
          edges: [
            {
              from: 'acct_tok_mule',
              to: 'acct_tok_downstream',
              kind: 'TRANSFERRED_TO',
              weight: 100,
              firstSeen: '2026-09-24T01:00:00.000Z',
              lastSeen: '2026-09-24T01:00:00.000Z',
              evidence: { sourceInstitution: 'BANK_C', evidenceType: 'PAYMENT_EVENT', observedAt: '2026-09-24T01:00:00.000Z', tenantScope: 'NETWORK', linkage: 'CORRELATED', scoring: 'CANDIDATE' },
            },
          ],
          truncated: false,
        },
      }),
      new Map(),
      null,
    );
    const candidate = scene.edges.find((edge) => edge.to === 'acct_tok_downstream');
    expect(candidate?.label).toContain('(candidate)');
    expect(scene.nodes.find((node) => node.id === 'acct_tok_downstream')?.unobserved).toBe(true);
  });

  it('lays the same scene out the same way, every node placed', () => {
    const { scene } = buildEvidenceGraph(evidence(), new Map(), null);
    const first = layoutGraph(scene).positions;
    expect(layoutGraph(scene).positions).toEqual(first);
    expect(Object.keys(first).sort()).toEqual(scene.nodes.map((node) => node.id).sort());
    expect(first[decision.accountId]).toEqual({ x: 0, y: 0 });
  });
});
