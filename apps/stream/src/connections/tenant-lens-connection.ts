import type { InstitutionId, StreamMessage } from '@sentinel/domain';
import type { ClientConnection } from './client-connection.js';

/**
 * Which institution owns each account, learned from the decisions the gateway relays (every alert and
 * intervention follows a decision for its account). Shared by every lensed connection in this process; it holds
 * nothing a reconnect cannot rebuild from the next snapshot.
 */
export class AccountInstitutionDirectory {
  private readonly owners = new Map<string, InstitutionId>();

  observe(message: StreamMessage): void {
    if (message.kind === 'DECISION') this.owners.set(message.payload.accountId, message.payload.institutionId);
    if (message.kind === 'SNAPSHOT') for (const decision of message.payload.decisions) this.owners.set(decision.accountId, decision.institutionId);
  }

  institutionOf(accountId: string): InstitutionId | undefined {
    return this.owners.get(accountId);
  }
}

/**
 * The tenant lens on the live stream (T§14): a lensed connection receives its own institution's records only.
 * Another institution's transaction history is withheld, not masked; a record whose owner is not yet known is
 * withheld too. Heartbeats pass unchanged. Transport-level projection only: no rule, score or decision changes.
 */
export function projectForLens(message: StreamMessage, lens: InstitutionId, directory: AccountInstitutionDirectory): StreamMessage | null {
  const own = (accountId: string) => directory.institutionOf(accountId) === lens;
  switch (message.kind) {
    case 'HEARTBEAT':
      return message;
    case 'DECISION':
      return message.payload.institutionId === lens ? message : null;
    case 'ALERT':
      return own(message.payload.accountId) ? message : null;
    case 'INTERVENTION':
      return own(message.payload.accountId) ? message : null;
    case 'SNAPSHOT':
      return {
        ...message,
        payload: {
          decisions: message.payload.decisions.filter((decision) => decision.institutionId === lens),
          alerts: message.payload.alerts.filter((alert) => own(alert.accountId)),
          interventions: message.payload.interventions.filter((intervention) => own(intervention.accountId)),
        },
      };
  }
}

/** Wraps a connection so everything sent to it passes through the lens first. */
export class TenantLensConnection implements ClientConnection {
  constructor(
    private readonly inner: ClientConnection,
    private readonly lens: InstitutionId,
    private readonly directory: AccountInstitutionDirectory,
  ) {}

  get id(): string {
    return this.inner.id;
  }

  send(message: StreamMessage): void {
    this.directory.observe(message);
    const projected = projectForLens(message, this.lens, this.directory);
    if (projected) this.inner.send(projected);
  }

  close(): void {
    this.inner.close();
  }
}
