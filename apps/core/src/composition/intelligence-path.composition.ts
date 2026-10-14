import type { HttpRouteRegistration } from '../api/http-route-registration.js';
import type { VertexAiSettings } from '../config/runtime-config.js';
import { VertexModelGateway } from '../infrastructure/ai/vertex-ai/gateway/vertex-model.gateway.js';
import { ModelRouter } from '../infrastructure/ai/vertex-ai/model-router/model-router.js';
import { CaseService } from '../modules/cases/application/case.service.js';
import type { ManageCase } from '../modules/cases/application/manage-case.use-case.js';
import type { CaseRepository } from '../modules/cases/application/ports/case-repository.port.js';
import type { ExploreNetwork } from '../modules/graph/application/explore-network.use-case.js';
import { GraphService } from '../modules/graph/application/graph.service.js';
import type { GraphRepository } from '../modules/graph/application/ports/graph-repository.port.js';
import { NetworkObservationController } from '../modules/graph/presentation/network-observation.controller.js';
import { networkObservationRoutes } from '../modules/graph/presentation/network-observation.routes.js';
import { IntelligenceService } from '../modules/intelligence/application/intelligence.service.js';
import type { ExplanationCache } from '../modules/intelligence/application/ports/explanation-cache.port.js';
import type { ModelGateway } from '../modules/intelligence/application/ports/model-gateway.port.js';
import { ResponseSchemaValidator } from '../modules/intelligence/application/response-schema.validator.js';
import { SourceFieldValidator } from '../modules/intelligence/application/source-field.validator.js';
import { EvidenceBundleCompiler } from '../modules/investigations/application/evidence-bundle.compiler.js';
import { InvestigationAdvisor } from '../modules/investigations/application/investigation-advisor.service.js';
import type { EvidenceSource } from '../modules/investigations/application/ports/evidence-source.port.js';
import { InvestigationController } from '../modules/investigations/presentation/investigation.controller.js';
import { investigationRoutes } from '../modules/investigations/presentation/investigation.routes.js';
import type { IdGenerator } from '../platform/ids/id-generator.js';
import type { Clock } from '../platform/time/clock.js';

export interface IntelligencePathPersistence {
  readonly evidence: EvidenceSource;
  readonly cases: CaseRepository;
  readonly graph: GraphRepository;
  readonly explanations: ExplanationCache;
}

export interface IntelligencePathDependencies {
  readonly persistence: IntelligencePathPersistence;
  readonly vertex: VertexAiSettings;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  /** Tests substitute a scripted model; production always reaches Vertex AI through VertexModelGateway. */
  readonly modelGateway?: ModelGateway;
}

export interface IntelligencePath {
  readonly routes: readonly HttpRouteRegistration[];
  readonly cases: ManageCase;
  readonly network: ExploreNetwork;
}

/**
 * Wires the asynchronous, best-effort intelligence path and the network ingest. Nothing here is reachable from
 * POST /v1/decision/transactions. AI explains.
 */
export function composeIntelligencePath({ persistence, vertex, ids, clock, modelGateway }: IntelligencePathDependencies): IntelligencePath {
  const intelligence = new IntelligenceService({
    modelGateway: modelGateway ?? new VertexModelGateway(new ModelRouter(vertex), vertex),
    explanations: persistence.explanations,
    responseSchemas: new ResponseSchemaValidator(),
    sourceFields: new SourceFieldValidator(),
    clock,
  });
  const bundles = new EvidenceBundleCompiler(persistence.evidence);
  const network = new GraphService(persistence.graph);

  return {
    routes: [
      networkObservationRoutes(new NetworkObservationController(network)),
      investigationRoutes(new InvestigationController(new InvestigationAdvisor(bundles, intelligence))),
    ],
    cases: new CaseService(persistence.cases, bundles, intelligence, ids),
    network,
  };
}
