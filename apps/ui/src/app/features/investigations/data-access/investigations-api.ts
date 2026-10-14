import { Injectable, inject } from '@angular/core';
import type { AdvisoryOutcome, CaseSummary, InvestigationEvidence, RiskExplanation } from '@sentinel/domain';
import type { Observable } from 'rxjs';
import { CoreApiClient } from '../../../core/http/api-client/core-api-client';

/** HTTP to sentinel-core only. Gemini is never called from the browser and no model identifier lives here. */
@Injectable({ providedIn: 'root' })
export class InvestigationsApi {
  private readonly core = inject(CoreApiClient);

  evidence(assessmentId: string): Observable<InvestigationEvidence> {
    return this.core.get<InvestigationEvidence>(`/v1/investigations/${encodeURIComponent(assessmentId)}/evidence`);
  }

  explain(assessmentId: string): Observable<AdvisoryOutcome<RiskExplanation>> {
    return this.core.post<AdvisoryOutcome<RiskExplanation>>(`/v1/investigations/${encodeURIComponent(assessmentId)}/explanation`, {});
  }

  summarise(assessmentId: string): Observable<AdvisoryOutcome<CaseSummary>> {
    return this.core.post<AdvisoryOutcome<CaseSummary>>(`/v1/investigations/${encodeURIComponent(assessmentId)}/case-summary`, {});
  }
}
