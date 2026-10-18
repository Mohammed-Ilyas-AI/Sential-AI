import { Injectable, inject } from '@angular/core';
import type { Case, CaseReport, CaseReportSectionId, CaseReportVersion } from '@sentinel/domain';
import type { Observable } from 'rxjs';
import { map } from 'rxjs';
import { CoreApiClient } from '../../../core/http/api-client/core-api-client';

export interface Written<TRecord> {
  readonly outcome: 'CREATED' | 'DUPLICATE';
  readonly record: TRecord;
}

export interface CaseReportEdit {
  readonly id: CaseReportSectionId;
  readonly body: string;
}

@Injectable()
export class CasesApi {
  private readonly core = inject(CoreApiClient);

  list(): Observable<readonly Case[]> {
    return this.core.get<{ readonly cases: readonly Case[] }>('/v1/cases').pipe(map((response) => response.cases));
  }

  open(alertId: string, analystIdentity: string): Observable<Written<Case>> {
    return this.core.post<Written<Case>>('/v1/cases', { alertId, analystIdentity });
  }

  get(caseId: string): Observable<Case> {
    return this.core.get<Case>(`/v1/cases/${encodeURIComponent(caseId)}`);
  }

  escalate(caseId: string, analystIdentity: string): Observable<Case> {
    return this.core.post<Case>(`/v1/cases/${encodeURIComponent(caseId)}/escalate`, { analystIdentity });
  }

  report(caseId: string): Observable<CaseReport> {
    return this.core.get<CaseReport>(`/v1/cases/${encodeURIComponent(caseId)}/report`);
  }

  generateReport(caseId: string, analystIdentity: string): Observable<Written<CaseReport>> {
    return this.core.post<Written<CaseReport>>(`/v1/cases/${encodeURIComponent(caseId)}/report`, { analystIdentity });
  }

  editReport(caseId: string, version: number, analystIdentity: string, expectedRevision: number, edits: readonly CaseReportEdit[]): Observable<CaseReportVersion> {
    return this.core.patch<CaseReportVersion>(`/v1/cases/${encodeURIComponent(caseId)}/report/${version}`, {
      analystIdentity,
      expectedRevision,
      edits,
    });
  }

  signOff(caseId: string, version: number, analystIdentity: string, expectedRevision: number): Observable<CaseReportVersion> {
    return this.core.post<CaseReportVersion>(`/v1/cases/${encodeURIComponent(caseId)}/report/${version}/sign-off`, {
      analystIdentity,
      expectedRevision,
    });
  }

  startRevision(caseId: string, version: number, analystIdentity: string): Observable<CaseReportVersion> {
    return this.core.post<CaseReportVersion>(`/v1/cases/${encodeURIComponent(caseId)}/report/revision`, {
      analystIdentity,
      fromVersion: version,
    });
  }

  exportReport(caseId: string, version: number): Observable<Blob> {
    return this.core.getBlob(`/v1/cases/${encodeURIComponent(caseId)}/report/${version}/export`);
  }
}
