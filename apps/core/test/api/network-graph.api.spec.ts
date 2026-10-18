import { DEMO_TAKEOVER_01, GRAPH_EDGE_CAP, GRAPH_NODE_CAP, LINKAGE_SCORING, type FundTraceView, type GraphEdge, type NetworkExploration, type NetworkObservation } from '@sentinel/domain';
import { INSTANT_TIMELINE, buildDemoTakeover01, playScenario, runScopedToken, type PlaybackReport } from '@sentinel/scenarios';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startCoreHarness, type CoreHarness } from '../support/harness/core-test-harness.js';
import { HttpBankConnector, callJson } from '../support/harness/http-bank-connector.js';
import { createInMemoryPersistence, type InMemoryPersistence } from '../support/in-memory-repositories/in-memory-persistence.js';

const EPOCH = '2026-09-24T11:30:00.000Z';
const RUN = 'GRAPH';
const token = (prefix: 'acct' | 'dev' | 'ben', id: string) => runScopedToken(prefix, id, RUN);
const VICTIM = token('acct', DEMO_TAKEOVER_01.accountDisplayId);
const HELD_DESTINATION = token('acct', 'PAYEE-7742');

const edge = (from: string, to: string, weight: number, scope: 'OWN' | 'NETWORK' = 'NETWORK', linkage: GraphEdge['evidence']['linkage'] = 'NETWORK_REFERENCE'): GraphEdge => ({
  from,
  to,
  kind: 'TRANSFERRED_TO',
  weight,
  firstSeen: EPOCH,
  lastSeen: EPOCH,
  evidence: { sourceInstitution: 'BANK_C', evidenceType: 'PAYMENT_EVENT', observedAt: EPOCH, tenantScope: scope, linkage, scoring: LINKAGE_SCORING[linkage] },
});
const node = (id: string, institutionId = 'BANK_C') => ({ id, kind: 'ACCOUNT' as const, institutionId, flagged: false, riskIndicators: [], txCount: 1 });

/**
 * The server-side entity graph (M§5.5, T§8) over DEMO_TAKEOVER_01 played through the real control path: two hops,
 * capped, heaviest first, every edge with its provenance; a fund trace that stops where observation stops; and
 * the tenant lens projected before anything leaves the server.
 */
describe('Network neighbourhood and fund trace', () => {
  const persistence: InMemoryPersistence = createInMemoryPersistence();
  let harness: CoreHarness;
  let report: PlaybackReport;
  const get = <T>(path: string, lens?: string) => callJson<T>(harness.baseUrl, 'GET', path, undefined, lens ? { 'x-sentinel-lens': lens } : {});

  beforeAll(async () => {
    harness = await startCoreHarness(persistence, { clockStart: EPOCH });
    report = await playScenario(buildDemoTakeover01(EPOCH, { runId: RUN }), new HttpBankConnector(harness.baseUrl, harness.clock), INSTANT_TIMELINE);
  });
  afterAll(() => harness.close());

  describe('neighbourhood', () => {
    it('unfolds the held destination across three institutions, each edge once, with its provenance', async () => {
      const { status, body } = await get<NetworkExploration>(`/v1/network/${HELD_DESTINATION}/neighbourhood?hops=2`);
      expect(status).toBe(200);
      expect(body.rootId).toBe(HELD_DESTINATION);
      expect(new Set(body.nodes.map((candidate) => candidate.institutionId))).toEqual(new Set(['BANK_A', 'BANK_B', 'BANK_C']));
      expect(new Set(body.edges.map((candidate) => candidate.id)).size).toBe(body.edges.length);
      expect(new Set(body.nodes.map((candidate) => candidate.id)).size).toBe(body.nodes.length);
      expect(body.edges.map((candidate) => candidate.evidence.linkage).sort()).toEqual([...DEMO_TAKEOVER_01.finalPayeeFlaggedLinks].sort());
      expect(body.nodes.find((candidate) => candidate.id === HELD_DESTINATION)?.hops).toBe(0);
      expect(body.nodes.filter((candidate) => candidate.id !== HELD_DESTINATION).every((candidate) => candidate.hops === 1)).toBe(true);
      expect(body.truncated).toBe(false);
    });

    it('starts from the case account with its own settled transfers, never the held one', async () => {
      const { body } = await get<NetworkExploration>(`/v1/network/${VICTIM}/neighbourhood?hops=1`);
      const own = body.edges.filter((candidate) => candidate.from === VICTIM);
      expect(own.every((candidate) => candidate.evidence.linkage === 'DIRECT' && candidate.evidence.tenantScope === 'OWN')).toBe(true);
      expect(own.map((candidate) => candidate.to)).not.toContain(HELD_DESTINATION);
      const settledTo9281 = report.transfers
        .filter((transfer) => transfer.step.request.destinationAccountToken === token('acct', 'PAYEE-9281') && transfer.response.decision === 'ALLOW')
        .reduce((total, transfer) => total + transfer.step.request.amount, 0);
      expect(own.find((candidate) => candidate.to === token('acct', 'PAYEE-9281'))?.weight).toBe(settledTo9281);
    });

    it('masks other institutions for a lens: reference, indicators, counts and their value moved', async () => {
      const operator = await get<NetworkExploration>(`/v1/network/${HELD_DESTINATION}/neighbourhood`);
      const { body } = await get<NetworkExploration>(`/v1/network/${HELD_DESTINATION}/neighbourhood`, 'BANK_A');
      expect(body.lens).toBe('BANK_A');
      for (const candidate of body.nodes) {
        if (candidate.institutionId === 'BANK_A') {
          expect(candidate.masked).toBe(false);
          continue;
        }
        expect(candidate).toMatchObject({ masked: true, riskIndicators: [], txCount: null });
        expect(candidate.label).toMatch(/^••••[A-Za-z0-9]{1,4}$/);
      }
      expect(body.edges.filter((candidate) => candidate.evidence.sourceInstitution !== 'BANK_A').every((candidate) => candidate.weight === null)).toBe(true);
      // Masking never changes the shape: the same nodes and relationships, with the same hop counts.
      expect(body.nodes.map((candidate) => [candidate.id, candidate.hops])).toEqual(operator.body.nodes.map((candidate) => [candidate.id, candidate.hops]));
      expect(JSON.stringify(body)).not.toContain('ACC-55902');
    });

    it('refuses an unknown root, an unknown lens and an unsupported depth', async () => {
      expect((await get(`/v1/network/acct_nobody/neighbourhood`)).status).toBe(404);
      expect((await get(`/v1/network/${HELD_DESTINATION}/neighbourhood`, 'BANK_Q')).status).toBe(400);
      expect((await get(`/v1/network/${HELD_DESTINATION}/neighbourhood?hops=3`)).status).toBe(400);
    });
  });

  describe('fund trace', () => {
    it('follows the settled money out of the victim account and stops where the receiving bank’s leg ends', async () => {
      const settled = new Map<string, { amount: number; institution: string }>();
      for (const transfer of report.transfers) {
        const request = transfer.step.request;
        if (request.sourceAccountToken !== VICTIM || transfer.response.decision !== 'ALLOW') continue;
        const current = settled.get(request.destinationAccountToken) ?? { amount: 0, institution: request.destinationInstitutionId };
        settled.set(request.destinationAccountToken, { ...current, amount: current.amount + request.amount });
      }
      const [heaviest, moved] = [...settled.entries()].sort((left, right) => right[1].amount - left[1].amount)[0] ?? [];
      const { body } = await get<FundTraceView>(`/v1/network/${VICTIM}/fund-trace`);
      expect(body.hops[0]).toMatchObject({ from: VICTIM, to: heaviest, kind: 'TRANSFERRED_TO', weight: moved?.amount });
      const complete = moved?.institution === 'BANK_A';
      expect(body.observability).toEqual(
        complete ? { complete: true, observedHops: 1 } : { complete: false, observedHops: 1, reason: 'OUTSIDE_OBSERVED_NETWORK', boundary: moved?.institution },
      );
      expect(body.hops.map((hop) => hop.to)).not.toContain(HELD_DESTINATION);
    });

    it('follows a chosen first hop when asked: the takeover transfer into Bank B, ending at Bank B', async () => {
      const via = token('acct', 'PAYEE-3821');
      const { body } = await get<FundTraceView>(`/v1/network/${VICTIM}/fund-trace?via=${via}`);
      expect(body.hops.map((hop) => [hop.from, hop.to, hop.evidence.linkage])).toEqual([[VICTIM, via, 'DIRECT']]);
      expect(body.observability).toEqual({ complete: false, observedHops: 1, reason: 'OUTSIDE_OBSERVED_NETWORK', boundary: 'BANK_B' });
      const none = await get<FundTraceView>(`/v1/network/${VICTIM}/fund-trace?via=${HELD_DESTINATION}`);
      expect(none.body.observability).toEqual({ complete: false, observedHops: 0, reason: 'NO_OUTFLOW_OBSERVED' });
    });

    it('carries the observed path into the network and ends at the boundary institution, never an invented hop', async () => {
      const { body } = await get<FundTraceView>(`/v1/network/${HELD_DESTINATION}/fund-trace`);
      expect(body.hops.length).toBeGreaterThan(0);
      expect(body.hops.every((hop, index) => index === 0 || hop.from === body.hops[index - 1]?.to)).toBe(true);
      expect(body.observability.complete).toBe(false);
      expect(body.observability.reason).toBe('OUTSIDE_OBSERVED_NETWORK');
      expect(body.observability.boundary).toBe(body.nodes.find((candidate) => candidate.id === body.hops.at(-1)?.to)?.institutionId);
    });

    it('answers an account with no observed outflow explicitly', async () => {
      const quiet = token('acct', 'PAYEE-7742');
      const { body } = await get<FundTraceView>(`/v1/network/${token('dev', 'DEV-SHARED-01')}/fund-trace`);
      expect(body.observability).toEqual({ complete: false, observedHops: 0, reason: 'NO_OUTFLOW_OBSERVED' });
      expect(quiet).toBeTruthy();
    });
  });

  describe('bounded traversal', () => {
    it('stops a cycle instead of looping', async () => {
      const observation: NetworkObservation = {
        schemaVersion: '1.0',
        nodes: [node('acct_cycle_a'), node('acct_cycle_b')],
        edges: [edge('acct_cycle_a', 'acct_cycle_b', 500), edge('acct_cycle_b', 'acct_cycle_a', 400)],
      };
      await callJson(harness.baseUrl, 'POST', '/v1/network/observations', observation);
      const { body } = await get<FundTraceView>('/v1/network/acct_cycle_a/fund-trace');
      expect(body.hops.map((hop) => hop.to)).toEqual(['acct_cycle_b']);
      expect(body.observability).toMatchObject({ complete: false, reason: 'CYCLE_DETECTED' });
    });

    it('ends at an UNOBSERVED link and marks it as the boundary', async () => {
      const observation: NetworkObservation = {
        schemaVersion: '1.0',
        nodes: [node('acct_seen'), node('acct_unseen', 'BANK_B')],
        edges: [edge('acct_seen', 'acct_unseen', 900, 'NETWORK', 'UNOBSERVED')],
      };
      await callJson(harness.baseUrl, 'POST', '/v1/network/observations', observation);
      const trace = await get<FundTraceView>('/v1/network/acct_seen/fund-trace');
      expect(trace.body.observability).toEqual({ complete: false, observedHops: 1, reason: 'UNOBSERVED_LINK', boundary: 'BANK_B' });
      const around = await get<NetworkExploration>('/v1/network/acct_seen/neighbourhood?hops=1');
      expect(around.body.boundaries).toContainEqual({ nodeId: 'acct_unseen', reason: 'UNOBSERVED_LINK', institutionId: 'BANK_B' });
    });

    it('caps a fan-out at 40 nodes and 120 edges, keeps the heaviest edges and says where it stopped', async () => {
      const spokes = Array.from({ length: 60 }, (_, index) => `acct_spoke_${String(index).padStart(2, '0')}`);
      const observation: NetworkObservation = {
        schemaVersion: '1.0',
        nodes: [node('acct_hub'), ...spokes.map((id) => node(id))],
        edges: spokes.map((id, index) => edge('acct_hub', id, 1_000 + index)),
      };
      await callJson(harness.baseUrl, 'POST', '/v1/network/observations', observation);
      const { body } = await get<NetworkExploration>('/v1/network/acct_hub/neighbourhood?hops=2');
      expect(body.nodes.length).toBe(GRAPH_NODE_CAP);
      expect(body.edges.length).toBeLessThanOrEqual(GRAPH_EDGE_CAP);
      expect(body.truncated).toBe(true);
      expect(Math.min(...body.edges.map((candidate) => candidate.weight ?? 0))).toBe(1_000 + 60 - (GRAPH_NODE_CAP - 1));
      expect(body.boundaries).toContainEqual({ nodeId: 'acct_hub', reason: 'CAPPED', institutionId: 'BANK_C' });
    });

    it('leaves ENTITY_LINK scoring as it was: the graph reads never write an edge', async () => {
      const before = await persistence.entityLinks.flaggedLinksFor(HELD_DESTINATION);
      await get(`/v1/network/${HELD_DESTINATION}/neighbourhood`);
      await get(`/v1/network/${VICTIM}/fund-trace`);
      expect(await persistence.entityLinks.flaggedLinksFor(HELD_DESTINATION)).toEqual(before);
      const final = report.transfers.at(-1);
      expect(final?.response).toMatchObject({ decision: 'HOLD', riskScore: DEMO_TAKEOVER_01.finalScore });
    });
  });
});
