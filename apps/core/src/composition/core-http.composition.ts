import type { Express } from 'express';
import { createApp } from '../app.js';
import type { CoreRuntimeConfig } from '../config/runtime-config.js';
import {
  GoogleOidcPushAuthenticator,
  LOCAL_DEVELOPMENT_PUSH_AUTHENTICATOR,
  type PushAuthenticator,
} from '../infrastructure/messaging/pubsub/push-authentication/push-authenticator.js';
import type { Logger } from '../infrastructure/telemetry/logger.js';
import type { ModelGateway } from '../modules/intelligence/application/ports/model-gateway.port.js';
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
    'corsAllowedOrigins' | 'rapidDrainPolicy' | 'designatedBillingPayeeIds' | 'demoTimeCompression' | 'pubsubPush' | 'vertex'
  >;
  readonly persistence: SentinelPersistence;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly logger: Logger;
  /** Tests only: a scripted model in place of Vertex AI. */
  readonly modelGateway?: ModelGateway;
}

function pushAuthenticatorFor(config: CoreHttpInputs['config']): PushAuthenticator {
  return config.pubsubPush.mode === 'google-oidc'
    ? new GoogleOidcPushAuthenticator(config.pubsubPush.audience, config.pubsubPush.serviceAccountEmail)
    : LOCAL_DEVELOPMENT_PUSH_AUTHENTICATOR;
}

/** The whole HTTP surface for a given persistence: used by main.ts with Atlas and by tests with in-memory adapters. */
export function composeCoreHttp({ config, persistence, clock, ids, logger, modelGateway }: CoreHttpInputs): CoreHttpComposition {
  const controlPath = composeControlPath({
    persistence,
    rapidDrainPolicy: config.rapidDrainPolicy,
    designatedBillingPayeeIds: config.designatedBillingPayeeIds,
    demoTimeCompression: config.demoTimeCompression,
    pushAuthenticator: pushAuthenticatorFor(config),
    clock,
    ids,
    logger,
  });
  const intelligencePath = composeIntelligencePath({ persistence, vertex: config.vertex, ids, clock, ...(modelGateway ? { modelGateway } : {}) });
  const app = createApp({
    routes: [...controlPath.routes, ...intelligencePath.routes],
    corsAllowedOrigins: config.corsAllowedOrigins,
    logger,
  });
  return { app, controlPath };
}
