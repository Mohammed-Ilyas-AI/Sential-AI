import type { IsoTimestamp } from '../time/iso-timestamp.js';
import type { CaseSummary } from './case-summary.js';
import type { EvidenceBundle } from './evidence-bundle.js';

/**
 * The investigation agent's read-only tools. Each one reads one section of the evidence bundle already compiled
 * for the assessment under investigation: the agent chooses what to look at and in which order, but it cannot
 * reach another account, write anything, or touch a score, a decision or a hold. There is no such tool.
 */
export type AgentEvidenceTool =
  | 'get_risk_assessment'
  | 'get_drain_state'
  | 'get_account_profile'
  | 'get_recent_transactions'
  | 'get_device_history'
  | 'get_payee_history'
  | 'get_prior_alerts'
  | 'get_interventions'
  | 'get_network_neighbourhood'
  | 'inspect_network_entity';

/** The terminal tool: the agent files its findings as a CaseSummary, validated like any other model output. */
export const AGENT_SUBMIT_FINDINGS_TOOL = 'submit_findings';

/** Which bundle section each tool reads; a claim may only cite a section the agent actually retrieved. */
export const AGENT_TOOL_BUNDLE_FIELD: Readonly<Record<AgentEvidenceTool, keyof EvidenceBundle>> = {
  get_risk_assessment: 'assessment',
  get_drain_state: 'drain',
  get_account_profile: 'account',
  get_recent_transactions: 'recentTransactions',
  get_device_history: 'deviceHistory',
  get_payee_history: 'payeeHistory',
  get_prior_alerts: 'priorAlerts',
  get_interventions: 'interventions',
  get_network_neighbourhood: 'neighbourhood',
  inspect_network_entity: 'neighbourhood',
};

/** One tool call the agent made, as the analyst sees it in the trace. */
export interface AgentToolStep {
  /** 1-based model turn in which the agent asked for this tool. */
  readonly round: number;
  readonly tool: AgentEvidenceTool;
  /** The arguments exactly as the model sent them, for the audit trail. */
  readonly args: Readonly<Record<string, unknown>>;
  readonly bundleField: keyof EvidenceBundle;
  /** Records returned: array length, or 1 for a single object, 0 for nothing found. */
  readonly records: number;
}

/**
 * The agent's result: its own evidence-gathering trace and a grounded CaseSummary. Advisory only. The summary's
 * claims are checked against the sections the agent retrieved, not merely against the whole bundle.
 */
export interface AgentInvestigation {
  readonly assessmentId: string;
  readonly steps: readonly AgentToolStep[];
  /** Model turns used, including the one that submitted the findings. */
  readonly rounds: number;
  readonly summary: CaseSummary;
  readonly generatedAt: IsoTimestamp;
}
