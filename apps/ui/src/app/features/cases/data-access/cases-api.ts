import type { Case } from '@sentinel/domain';
import type { Observable } from 'rxjs';

export abstract class CasesApi {
  abstract list(): Observable<readonly Case[]>;
  abstract escalate(caseId: string): Observable<Case>;
}
