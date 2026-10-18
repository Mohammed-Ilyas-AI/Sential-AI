import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, switchMap, tap, timer } from 'rxjs';
import type { PerformanceSnapshot } from '@sentinel/domain';
import { CoreApiClient } from '../../../../core/http/api-client/core-api-client';

const PATH_LABELS: Readonly<Record<string, string>> = {
  decisionApi: 'Pre-transaction decision API',
  securityEventIngest: 'Security event ingestion',
  transactionLifecycleIngest: 'Transaction lifecycle ingestion',
  graphQuery: 'Network graph queries',
};

@Component({
  selector: 'sentinel-performance-panel',
  imports: [DatePipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './performance-panel.html',
  styleUrl: './performance-panel.css',
})
export class PerformancePanel {
  private readonly api = inject(CoreApiClient);
  protected readonly snapshot = signal<PerformanceSnapshot | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly now = signal(Date.now());
  protected readonly stale = computed(() => {
    const snapshot = this.snapshot();
    return snapshot !== null && Date.parse(snapshot.capturedAt) < this.now() - 60_000;
  });
  protected readonly label = (path: string): string => PATH_LABELS[path] ?? path;

  constructor() {
    timer(0, 30_000)
      .pipe(
        tap(() => {
          this.now.set(Date.now());
          this.loading.set(this.snapshot() === null);
        }),
        switchMap(() =>
          this.api.get<PerformanceSnapshot>('/v1/metrics/performance').pipe(
            tap((snapshot) => {
              this.snapshot.set(snapshot);
              this.failed.set(false);
              this.loading.set(false);
            }),
            catchError(() => {
              this.failed.set(true);
              this.loading.set(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe();
  }
}
