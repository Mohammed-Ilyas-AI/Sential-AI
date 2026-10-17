import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Store } from '@ngrx/store';
import type { InstitutionId } from '@sentinel/domain';
import { CoreApiClient } from '../../../core/http/api-client/core-api-client';
import { sessionFeature } from '../../../state/session/session.feature';
import { transactionsFeature } from '../../../state/transactions/transactions.feature';

export type Health = 'CHECKING' | 'UP' | 'DOWN';

export interface InstitutionTraffic {
  readonly institutionId: InstitutionId;
  readonly sent: number;
  readonly received: number;
  readonly held: number;
}

const HEALTH_POLL_MS = 10_000;

/** How the participating banks connect, and whether each link is up right now (M§5.8). */
@Injectable()
export class IntegrationsFacade {
  private readonly core = inject(CoreApiClient);
  private readonly store = inject(Store);
  private readonly tape = this.store.selectSignal(transactionsFeature.selectTape);
  private readonly coreHealth = signal<{ readonly health: Health; readonly uptimeSeconds: number | null; readonly checkedAt: string | null }>({
    health: 'CHECKING',
    uptimeSeconds: null,
    checkedAt: null,
  });

  readonly core$ = this.coreHealth.asReadonly();
  readonly streamStatus = this.store.selectSignal(sessionFeature.selectStreamStatus);

  constructor() {
    this.check();
    const timer = setInterval(() => this.check(), HEALTH_POLL_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  readonly institutions = computed((): readonly InstitutionTraffic[] => {
    const traffic = new Map<InstitutionId, { sent: number; received: number; held: number }>();
    const entry = (id: InstitutionId) => {
      const known = traffic.get(id);
      if (known) return known;
      const created = { sent: 0, received: 0, held: 0 };
      traffic.set(id, created);
      return created;
    };
    for (const row of this.tape()) {
      const source = entry(row.institutionId);
      source.sent += 1;
      if (row.decision === 'HOLD') source.held += 1;
      entry(row.destinationInstitutionId).received += 1;
    }
    return [...traffic.entries()].map(([institutionId, counts]) => ({ institutionId, ...counts })).sort((left, right) => left.institutionId.localeCompare(right.institutionId));
  });

  check(): void {
    this.core.get<{ readonly status?: string; readonly uptimeSeconds?: number }>('/healthz').subscribe({
      next: (body) =>
        this.coreHealth.set({ health: body.status === 'ok' ? 'UP' : 'DOWN', uptimeSeconds: body.uptimeSeconds ?? null, checkedAt: new Date().toISOString() }),
      error: () => this.coreHealth.set({ health: 'DOWN', uptimeSeconds: null, checkedAt: new Date().toISOString() }),
    });
  }
}
