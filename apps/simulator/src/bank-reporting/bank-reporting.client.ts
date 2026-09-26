import type { BankAccountReport, NetworkObservation } from '@sentinel/domain';
import type { CoreHttpClient } from '../decision-api/core-http.client.js';

/** The bank's account reports and its tokenised network contributions. */
export class HttpBankReportingClient {
  constructor(private readonly core: CoreHttpClient) {}

  async reportAccount(report: BankAccountReport): Promise<void> {
    await this.core.send('PUT', `/v1/accounts/${encodeURIComponent(report.accountToken)}`, report);
  }

  async observeNetwork(observation: NetworkObservation): Promise<void> {
    await this.core.send('POST', '/v1/network/observations', observation);
  }
}
