import type { Transaction, TransactionEvent } from '@sentinel/domain';

/** The canonical event seen as a Transaction: identifier fields carry tokens, never raw account numbers. */
export function transactionFromEvent(event: TransactionEvent): Transaction {
  return {
    id: event.transactionId,
    ts: event.occurredAt,
    sourceAccountId: event.sourceAccountToken,
    destAccountId: event.destinationAccountToken,
    payeeId: event.beneficiaryToken ?? event.destinationAccountToken,
    deviceId: event.deviceToken ?? '',
    amount: event.amount,
    channel: event.channel,
    type: event.type,
    institutionId: event.tenantId,
    destInstitutionId: event.destinationInstitutionId,
  };
}
