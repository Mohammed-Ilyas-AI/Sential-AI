import type { CaseSummary, EvidenceBundle } from '@sentinel/domain';
import type { Observable } from 'rxjs';

/** HTTP to sentinel-core only. Gemini is never called from the browser. */
export abstract class InvestigationsApi {
  abstract evidenceFor(alertId: string): Observable<EvidenceBundle>;
  abstract summarise(alertId: string): Observable<CaseSummary>;
}
