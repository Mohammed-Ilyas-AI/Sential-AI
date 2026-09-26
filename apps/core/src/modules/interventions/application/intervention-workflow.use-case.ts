import type { DecisionRecord, Intervention, RecordedRiskAssessment } from '@sentinel/domain';

/**
 * The intervention state machine (T§4). The system applies the policy; analysts work the exceptions.
 * An analyst can confirm fraud and reject, but never release a policy hold without customer verification.
 */
export interface InterventionWorkflow {
  placeHold(decision: DecisionRecord, assessment: RecordedRiskAssessment): Promise<Intervention>;
  releaseAfterCoolingPeriod(transactionId: string): Promise<Intervention>;
  releaseAfterCustomerVerification(transactionId: string): Promise<Intervention>;
  cancelByCustomer(transactionId: string): Promise<Intervention>;
  rejectAsConfirmedFraud(transactionId: string, analystIdentity: string): Promise<Intervention>;
}
