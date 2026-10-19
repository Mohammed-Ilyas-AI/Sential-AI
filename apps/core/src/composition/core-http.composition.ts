import type { Express } from 'express';
import { createApp } from '../app.js';
import type { CoreRuntimeConfig } from '../config/runtime-config.js';
import {
  GoogleOidcPushAuthenticator,
  LOCAL_DEVELOPMENT_PUSH_AUTHENTICATOR,
  type PushAuthenticator,
} from '../infrastructure/messaging/pubsub/push-authentication/push-authenticator.js';
import type { Logger } from '../infrastructure/telemetry/logger.js';
import { AuditTrail } from '../modules/audit/application/audit-trail.js';
import { auditEventRoutes } from '../modules/audit/presentation/audit-event.routes.js';
import type { ModelGateway } from '../modules/intelligence/application/ports/model-gateway.port.js';
import { TenantAccessService } from '../modules/tenant-access/application/tenant-access.service.js';
import { ScenarioLaunchService } from '../modules/scenarios/application/scenario-launch.service.js';
import type { ScenarioRunner } from '../modules/scenarios/application/ports/scenario-runner.port.js';
import { scenarioRunRoutes } from '../modules/scenarios/presentation/scenario-run.routes.js';
import { LiveDemoService } from '../modules/scenarios/application/live-demo.service.js';
import { liveDemoRoutes } from '../modules/scenarios/presentation/live-demo.routes.js';
import { InProcessBankConnector, RealTimeTimeline } from '../infrastructure/scenario-launch/in-process-bank-connector.js';
import type { ScenarioTimeline } from '@sentinel/scenarios';
import {
  CloudRunJobScenarioRunner,
  DisabledScenarioRunner,
  LocalProcessScenarioRunner,
} from '../infrastructure/scenario-launch/scenario-runners.js';
import type { ScenarioLauncherSettings } from '../config/runtime-config.js';
import { PerformanceMetrics } from '../modules/telemetry/application/performance-metrics.js';
import { performanceRoutes } from '../modules/telemetry/presentation/performance.routes.js';
import type { IdGenerator } from '../platform/ids/id-generator.js';
import type { Clock } from '../platform/time/clock.js';
import { composeControlPath, type ControlPath } from './control-path.composition.js';
import { composeIntelligencePath } from './intelligence-path.composition.js';
import type { SentinelPersistence } from './mongo-persistence.composition.js';

export interface CoreHttpComposition {
  readonly app: Express;
  readonly controlPath: ControlPath;
}

export interface CoreHttpInputs {
  readonly config: Pick<
    CoreRuntimeConfig,
    'corsAllowedOrigins' | 'rapidDrainPolicy' | 'designatedBillingPayeeIds' | 'demoTimeCompression' | 'pubsubPush' | 'vertex' | 'scenarioLauncher'
  >;
  readonly persistence: SentinelPersistence;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly logger: Logger;
  /** Tests only: a scripted model in place of Vertex AI. */
  readonly modelGateway?: ModelGateway;
  /** Tests only: a scripted launcher in place of the configured one. */
  readonly scenarioRunner?: ScenarioRunner;
  /** Tests only: the live demo's clock, instant instead of real time. */
  readonly liveDemoTimeline?: () => ScenarioTimeline;
}

function scenarioRunnerFor(settings: ScenarioLauncherSettings, clock: Clock): ScenarioRunner {
  if (settings.mode === 'local-process') return new LocalProcessScenarioRunner(settings, clock);
  if (settings.mode === 'cloud-run-job') return new CloudRunJobScenarioRunner(settings, clock);
  return new DisabledScenarioRunner();
}

function pushAuthenticatorFor(config: CoreHttpInputs['config']): PushAuthenticator {
  return config.pubsubPush.mode === 'google-oidc'
    ? new GoogleOidcPushAuthenticator(config.pubsubPush.audience, config.pubsubPush.serviceAccountEmail)
    : LOCAL_DEVELOPMENT_PUSH_AUTHENTICATOR;
}

/** The whole HTTP surface for a given persistence: used by main.ts with Atlas and by tests with in-memory adapters. */
export function composeCoreHttp({ config, persistence, clock, ids, logger, modelGateway, scenarioRunner, liveDemoTimeline }: CoreHttpInputs): CoreHttpComposition {
  const audit = new AuditTrail(persistence.auditLog, clock, ids);
  const tenantAccess = new TenantAccessService(persistence.accounts, audit);
  const performanceMetrics = new PerformanceMetrics(clock);
  const controlPath = composeControlPath({
    persistence,
    rapidDrainPolicy: config.rapidDrainPolicy,
    designatedBillingPayeeIds: config.designatedBillingPayeeIds,
    demoTimeCompression: config.demoTimeCompression,
    pushAuthenticator: pushAuthenticatorFor(config),
    clock,
    ids,
    logger,
    audit,
    tenantAccess,
  });
  const intelligencePath = composeIntelligencePath({
    persistence,
    vertex: config.vertex,
    ids,
    clock,
    logger,
    audit,
    access: tenantAccess,
    ...(modelGateway ? { modelGateway } : {}),
  });
  const liveDemo = new LiveDemoService(
    new InProcessBankConnector({ ...controlPath.bank, observations: intelligencePath.network }),
    liveDemoTimeline ?? (() => new RealTimeTimeline()),
    audit,
    clock,
  );
  const app = createApp({
    routes: [
      ...controlPath.routes,
      ...intelligencePath.routes,
      auditEventRoutes(audit),
      performanceRoutes(performanceMetrics),
      liveDemoRoutes(liveDemo),
      scenarioRunRoutes(new ScenarioLaunchService(persistence.scenarioRuns, scenarioRunner ?? scenarioRunnerFor(config.scenarioLauncher, clock), audit, clock)),
    ],
    corsAllowedOrigins: config.corsAllowedOrigins,
    logger,
    performanceMetrics,
  });
  return { app, controlPath };
}
