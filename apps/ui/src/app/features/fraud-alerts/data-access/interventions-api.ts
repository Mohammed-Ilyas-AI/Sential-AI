import { Injectable, inject } from '@angular/core';
import type { Intervention } from '@sentinel/domain';
import type { Observable } from 'rxjs';
import { CoreApiClient } from '../../../core/http/api-client/core-api-client';

/** The exception routes around a policy hold. There is deliberately no analyst release. */
@Injectable({ providedIn: 'root' })
export class InterventionsApi {
  private readonly core = inject(CoreApiClient);

  releaseAfterCustomerVerification(transactionId: string): Observable<Intervention> {
    return this.core.post<Intervention>(`/v1/interventions/${encodeURIComponent(transactionId)}/customer-verified-release`, {});
  }

  cancelByCustomer(transactionId: string): Observable<Intervention> {
    return this.core.post<Intervention>(`/v1/interventions/${encodeURIComponent(transactionId)}/customer-cancellation`, {});
  }

  confirmFraud(transactionId: string, analystIdentity: string): Observable<Intervention> {
    return this.core.post<Intervention>(`/v1/interventions/${encodeURIComponent(transactionId)}/fraud-confirmation`, { analystIdentity });
  }
}
