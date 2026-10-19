import type { CustomerOutreachDraft, EvidenceBundle } from '@sentinel/domain';

const sgd = (minorUnits: number): string =>
  `S$${(minorUnits / 100).toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * sentinel-core's fixed wording, used when Gemini is unavailable so the customer is still told. Only the paused
 * transfer's amount comes from the bundle; nothing else is variable.
 */
export function templateOutreach(evidence: EvidenceBundle): CustomerOutreachDraft {
  const transfer = evidence.recentTransactions.find((transaction) => transaction.id === evidence.assessment.transactionId);
  const what = transfer ? `a transfer of ${sgd(transfer.amount)}` : 'a transfer';
  return {
    subject: 'We have paused a transfer from your account',
    emailBody: [
      `To protect your money, we have paused ${what} from your account while we check it with you.`,
      'If you did not make this transfer, or someone asked you to make it, please call us on the number on the back of your card, or open the bank app yourself.',
      'We will never ask for your password, PIN or one-time code, and this message contains no links.',
    ].join('\n\n'),
    callScript: [
      `This is an automated security call from your bank. We have paused ${what} from your account to keep your money safe.`,
      'Please call us on the number on the back of your card, or open the bank app yourself, to confirm whether you made it.',
      'We will never ask for your password, PIN or one-time code.',
    ].join(' '),
  };
}
