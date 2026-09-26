import { DEMO_TAKEOVER_01 } from '@sentinel/domain';
import { muleNetworkGenerator, createSeededRandom, syntheticToken } from '@sentinel/scenarios';
import { describe, expect, it } from 'vitest';
import type { GraphRepository } from '../../src/modules/graph/application/ports/graph-repository.port.js';
import type { EntityLinkSource } from '../../src/modules/risk/application/ports/entity-link-source.port.js';

export interface NetworkGraphPorts {
  readonly graph: GraphRepository;
  readonly entityLinks: EntityLinkSource;
}

const observation = () =>
  muleNetworkGenerator.generate(createSeededRandom(1), {
    destinationPayeeId: 'PAYEE-7742',
    destinationInstitutionId: 'BANK_C',
    flaggedLinks: DEMO_TAKEOVER_01.finalPayeeFlaggedLinks,
    observedAt: '2026-09-24T08:00:00.000Z',
  });

export function describeNetworkGraphContract(adapterName: string, createPorts: () => NetworkGraphPorts | Promise<NetworkGraphPorts>): void {
  describe(`Network graph contract: ${adapterName}`, () => {
    it('reports the flagged links around a recorded destination, one per flagged entity', async () => {
      const { graph, entityLinks } = await createPorts();
      await graph.recordObservation(observation());
      const links = await entityLinks.flaggedLinksFor(syntheticToken('acct', 'PAYEE-7742'));
      expect([...links].sort()).toEqual([...DEMO_TAKEOVER_01.finalPayeeFlaggedLinks].sort());
    });

    it('records the same observation idempotently', async () => {
      const { graph, entityLinks } = await createPorts();
      await graph.recordObservation(observation());
      await graph.recordObservation(observation());
      expect(await entityLinks.flaggedLinksFor(syntheticToken('acct', 'PAYEE-7742'))).toHaveLength(5);
    });

    it('reports nothing for a destination with no network history', async () => {
      const { entityLinks } = await createPorts();
      expect(await entityLinks.flaggedLinksFor(syntheticToken('acct', 'PAYEE-9281'))).toEqual([]);
    });
  });
}
