import { OAuth2Client } from 'google-auth-library';

/**
 * sentinel-core is publicly reachable for the browser, so the push endpoint must prove each request came from
 * Pub/Sub: an unauthenticated CANCELLED event could otherwise zero an outflow and slip under the drain gate.
 */
export interface PushAuthenticator {
  authenticate(authorizationHeader: string | undefined): Promise<boolean>;
}

/** Verifies the Google-signed OIDC token Pub/Sub attaches, for the expected audience and push service account. */
export class GoogleOidcPushAuthenticator implements PushAuthenticator {
  private readonly client = new OAuth2Client();

  constructor(
    private readonly audience: string,
    private readonly serviceAccountEmail: string,
  ) {}

  async authenticate(authorizationHeader: string | undefined): Promise<boolean> {
    const token = authorizationHeader?.startsWith('Bearer ') ? authorizationHeader.slice('Bearer '.length) : undefined;
    if (!token) return false;
    try {
      const ticket = await this.client.verifyIdToken({ idToken: token, audience: this.audience });
      const payload = ticket.getPayload();
      return payload?.email === this.serviceAccountEmail && payload.email_verified === true;
    } catch {
      return false;
    }
  }
}

/** Local development only, selected explicitly by PUBSUB_PUSH_VERIFICATION=disabled-for-local-development. */
export const LOCAL_DEVELOPMENT_PUSH_AUTHENTICATOR: PushAuthenticator = { authenticate: async () => true };
