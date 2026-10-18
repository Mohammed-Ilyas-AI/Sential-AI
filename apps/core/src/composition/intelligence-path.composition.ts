import type { HttpRouteRegistration } from '../api/http-route-registration.js';
import type { VertexAiSettings } from '../config/runtime-config.js';
import { VertexModelGateway } from '../infrastructure/ai/vertex-ai/gateway/vertex-model.gateway.js';
import { ModelRouter } from '../infrastructure/ai/vertex-ai/model-router/model-router.js';
import { CaseService } from '../modules/cases/application/case.service.js';
import type { CaseReports, ManageCase } from '../modules/cases/application/manage-case.use-case.js';
import type { CaseRepository } from '../modules/cases/application/ports/case-repository.port.js';
import type { CaseReportRepository } from '../modules/cases/application/ports/case-report-repository.port.js';
import { TextReportDocumentRenderer } from '../modules/cases/infrastructure/text-report-document.renderer.js';
import type { ExploreNetwork } from '../modules/graph/application/explore-network.use-case.js';
import { GraphService } from '../modules/graph/application/graph.service.js';
import type { GraphRepository } from '../modules/graph/application/ports/graph-repository.port.js';
import { NetworkExplorationController } from '../modules/graph/presentation/network-exploration.controller.js';
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
import type { CaseSummaryArchive } from '../modules/investigations/application/ports/case-summary-archive.port.js';
import { InvestigationController } from '../modules/investigations/presentation/investigation.controller.js';
import { investigationRoutes } from '../modules/investigations/presentation/investigation.routes.js';
import { CaseController } from '../modules/cases/presentation/case.controller.js';
import { caseRoutes } from '../modules/cases/presentation/case.routes.js';
import type { AlertRepository } from '../modules/alerts/application/ports/alert-repository.port.js';
import type { DecisionRepository } from '../modules/decision/application/ports/decision-repository.port.js';
import type { AccountControlRepository } from '../modules/interventions/application/ports/account-control-repository.port.js';
import type { InterventionRepository } from '../modules/interventions/application/ports/intervention-repository.port.js';
import type { AuditTrail } from '../modules/audit/application/audit-trail.js';
import type { TenantAccessService } from '../modules/tenant-access/application/tenant-access.service.js';
import type { Logger } from '../infrastructure/telemetry/logger.js';
import type { IdGenerator } from '../platform/ids/id-generator.js';
import type { Clock } from '../platform/time/clock.js';

export interface IntelligencePathPersistence {
  readonly evidence: EvidenceSource;
  readonly cases: CaseRepository;
  readonly reports: CaseReportRepository;
  readonly summaries: CaseSummaryArchive;
  readonly graph: GraphRepository;
  readonly explanations: ExplanationCache;
  readonly alerts: AlertRepository;
  readonly decisions: DecisionRepository;
  readonly interventions: InterventionRepository;
  readonly accountControls: AccountControlRepository;
}

export interface IntelligencePathDependencies {
  readonly persistence: IntelligencePathPersistence;
  readonly vertex: VertexAiSettings;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  readonly audit: AuditTrail;
  readonly access: TenantAccessService;
  /** Gateway failures (timeouts, HTTP errors, missing credentials) are explained here, never to the browser. */
  readonly logger?: Logger;
  /** Tests substitute a scripted model; production always reaches Vertex AI through VertexModelGateway. */
  readonly modelGateway?: ModelGateway;
}

export interface IntelligencePath {
  readonly routes: readonly HttpRouteRegistration[];
  readonly cases: ManageCase & CaseReports;
  readonly network: ExploreNetwork;
}

/**
 * Wires the asynchronous, best-effort intelligence path and the network ingest. Nothing here is reachable from
 * POST /v1/decision/transactions. AI explains.
 */
export function composeIntelligencePath({ persistence, vertex, ids, clock, logger, modelGateway, audit, access }: IntelligencePathDependencies): IntelligencePath {
  const intelligence = new IntelligenceService({
    modelGateway: modelGateway ?? new VertexModelGateway(new ModelRouter(vertex), vertex, undefined, logger),
    explanations: persistence.explanations,
    responseSchemas: new ResponseSchemaValidator(),
    sourceFields: new SourceFieldValidator(),
    clock,
  });
  const bundles = new EvidenceBundleCompiler(persistence.evidence);
  const network = new GraphService(persistence.graph);
  const cases = new CaseService({
    cases: persistence.cases,
    reports: persistence.reports,
    bundles,
    alerts: persistence.alerts,
    decisions: persistence.decisions,
    interventions: persistence.interventions,
    accountControls: persistence.accountControls,
    summaries: persistence.summaries,
    renderer: new TextReportDocumentRenderer(),
    access,
    audit,
    clock,
    ids,
  });

  return {
    routes: [
      networkObservationRoutes(new NetworkObservationController(network), new NetworkExplorationController(network)),
      investigationRoutes(new InvestigationController(new InvestigationAdvisor(bundles, intelligence, persistence.summaries, clock, access))),
      caseRoutes(new CaseController(cases)),
    ],
    cases,
    network,
  };
}
