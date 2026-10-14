import type { HttpRouteRegistration } from '../api/http-route-registration.js';
import type { GeminiSettings } from '../config/runtime-config.js';
import type { GeminiEndpoint } from '../infrastructure/ai/gemini/endpoints/gemini-endpoint.js';
import { GeminiApiEndpoint } from '../infrastructure/ai/gemini/endpoints/gemini-api.endpoint.js';
import { VertexAiEndpoint } from '../infrastructure/ai/gemini/endpoints/vertex-ai.endpoint.js';
import { GeminiModelGateway } from '../infrastructure/ai/gemini/gateway/gemini-model.gateway.js';
import { ModelRouter } from '../infrastructure/ai/gemini/model-router/model-router.js';
import { CaseService } from '../modules/cases/application/case.service.js';
import type { ManageCase } from '../modules/cases/application/manage-case.use-case.js';
import type { CaseRepository } from '../modules/cases/application/ports/case-repository.port.js';
import type { ExploreNetwork } from '../modules/graph/application/explore-network.use-case.js';
import { GraphService } from '../modules/graph/application/graph.service.js';
import type { GraphRepository } from '../modules/graph/application/ports/graph-repository.port.js';
import { NetworkObservationController } from '../modules/graph/presentation/network-observation.controller.js';
import { networkObservationRoutes } from '../modules/graph/presentation/network-observation.routes.js';
import { IntelligenceService } from '../modules/intelligence/application/intelligence.service.js';
import { InvestigationAgentService } from '../modules/intelligence/application/investigation-agent.service.js';
import type { AgentModelGateway } from '../modules/intelligence/application/ports/agent-model-gateway.port.js';
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
  readonly gemini: GeminiSettings;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  /** Tests substitute scripted models; production always reaches Gemini through GeminiModelGateway. */
  readonly modelGateway?: ModelGateway;
  readonly agentGateway?: AgentModelGateway;
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
function geminiEndpointFor(gemini: GeminiSettings): GeminiEndpoint {
  return gemini.provider === 'gemini-api' ? new GeminiApiEndpoint(gemini.apiKey) : new VertexAiEndpoint(gemini);
}

export function composeIntelligencePath({ persistence, gemini, ids, clock, modelGateway, agentGateway }: IntelligencePathDependencies): IntelligencePath {
  const geminiGateway = new GeminiModelGateway(new ModelRouter(gemini), geminiEndpointFor(gemini));
  const responseSchemas = new ResponseSchemaValidator();
  const sourceFields = new SourceFieldValidator();
  const intelligence = new IntelligenceService({
    modelGateway: modelGateway ?? geminiGateway,
    explanations: persistence.explanations,
    responseSchemas,
    sourceFields,
    clock,
  });
  const agent = new InvestigationAgentService({ agentGateway: agentGateway ?? geminiGateway, responseSchemas, sourceFields, clock });
  const bundles = new EvidenceBundleCompiler(persistence.evidence);
  const network = new GraphService(persistence.graph);

  return {
    routes: [
      networkObservationRoutes(new NetworkObservationController(network)),
      investigationRoutes(new InvestigationController(new InvestigationAdvisor(bundles, intelligence, agent))),
    ],
    cases: new CaseService(persistence.cases, bundles, intelligence, ids),
    network,
  };
}
