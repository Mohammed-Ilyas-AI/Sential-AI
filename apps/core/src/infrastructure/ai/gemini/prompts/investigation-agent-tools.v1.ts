import { AGENT_SUBMIT_FINDINGS_TOOL, EVIDENCE_RECENT_TRANSACTIONS_CAP, type AgentEvidenceTool } from '@sentinel/domain';
import { CASE_SUMMARY_RESPONSE_SCHEMA } from '../response-schemas/case-summary.response-schema.js';

interface FunctionDeclaration {
  readonly name: AgentEvidenceTool | typeof AGENT_SUBMIT_FINDINGS_TOOL;
  readonly description: string;
  readonly parameters?: object;
}

/** Versioned function declarations for the investigation agent. Every evidence tool is read-only. */
export const INVESTIGATION_AGENT_TOOLS_V1: readonly FunctionDeclaration[] = [
  {
    name: 'get_risk_assessment',
    description: 'The deterministic risk assessment: score, band and every rule contribution with its points. Read-only.',
  },
  {
    name: 'get_drain_state',
    description: 'The rapid-drain safeguard state: balance at window start, 24-hour outflow, drain percentage, threshold met.',
  },
  { name: 'get_account_profile', description: 'The account profile: institution, opening date, protected status, cooling-off.' },
  {
    name: 'get_recent_transactions',
    description: 'Recent transfers from this account, newest first, with amounts in SGD cents and destinations.',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'integer', description: `How many, 1 to ${EVIDENCE_RECENT_TRANSACTIONS_CAP}. Default 20.` } },
    },
  },
  { name: 'get_device_history', description: 'Device and credential security events on this account (new device, password reset).' },
  { name: 'get_payee_history', description: 'Payees added to this account and when.' },
  { name: 'get_prior_alerts', description: 'Earlier alerts raised on this account.' },
  { name: 'get_interventions', description: 'Holds and other interventions already recorded, with reason codes. Read-only.' },
  {
    name: 'get_network_neighbourhood',
    description: 'The entity graph up to two hops from this account: accounts, payees, devices, institutions and the links between them.',
  },
  {
    name: 'inspect_network_entity',
    description: 'One entity of the neighbourhood with every link touching it, and the bundle path of each, to follow the money.',
    parameters: { type: 'object', required: ['entityId'], properties: { entityId: { type: 'string', description: 'A node id from the neighbourhood.' } } },
  },
  {
    name: AGENT_SUBMIT_FINDINGS_TOOL,
    description: 'File the investigation findings. Call once, after gathering evidence. Ends the investigation.',
    parameters: CASE_SUMMARY_RESPONSE_SCHEMA,
  },
];
