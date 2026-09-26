import type { DecisionRecord, Intervention, IsoTimestamp } from '@sentinel/domain';

/**
 * The intervention state machine (T§4). The system applies the policy; analysts work the exceptions.
 * An analyst can confirm fraud and reject, but never release a policy hold without customer verification.
 */
export interface InterventionWorkflow {
  placeHold(decision: DecisionRecord): Promise<Intervention>;
  releaseDueHolds(now: IsoTimestamp): Promise<number>;
  releaseAfterCustomerVerification(transactionId: string): Promise<Intervention>;
  cancelByCustomer(transactionId: string): Promise<Intervention>;
  rejectAsConfirmedFraud(transactionId: string, analystIdentity: string): Promise<Intervention>;
  history(transactionId: string): Promise<readonly Intervention[]>;
}
