import { AGENT_TOOL_BUNDLE_FIELD, EVIDENCE_RECENT_TRANSACTIONS_CAP, type AgentEvidenceTool, type EvidenceBundle } from '@sentinel/domain';

const DEFAULT_TRANSACTION_LIMIT = 20;

export interface ToolResult {
  readonly tool: AgentEvidenceTool;
  /** What the model receives. Always a plain object; an error is reported to the model, never thrown. */
  readonly response: Readonly<Record<string, unknown>>;
  readonly records: number;
}

const isTool = (name: string): name is AgentEvidenceTool => Object.hasOwn(AGENT_TOOL_BUNDLE_FIELD, name);

function limitOf(args: Readonly<Record<string, unknown>>): number {
  const raw = args['limit'];
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1) return DEFAULT_TRANSACTION_LIMIT;
  return Math.min(raw, EVIDENCE_RECENT_TRANSACTIONS_CAP);
}

/**
 * Executes the agent's read-only tools against the bundle compiled for this assessment and nothing else. The
 * response field names repeat the bundle's, so a claim can cite e.g. recentTransactions[2].amount exactly.
 */
export class AgentEvidenceToolbox {
  constructor(private readonly bundle: EvidenceBundle) {}

  run(name: string, args: Readonly<Record<string, unknown>>): ToolResult | null {
    if (!isTool(name)) return null;
    const { bundle } = this;
    switch (name) {
      case 'get_risk_assessment':
        return { tool: name, response: { assessment: bundle.assessment }, records: bundle.assessment.contributions.length };
      case 'get_drain_state':
        return { tool: name, response: { drain: bundle.drain }, records: 1 };
      case 'get_account_profile':
        return { tool: name, response: { account: bundle.account }, records: 1 };
      case 'get_recent_transactions': {
        // Newest first, as compiled; indices stay those of the bundle so citations remain exact.
        const recentTransactions = bundle.recentTransactions.slice(0, limitOf(args));
        return { tool: name, response: { recentTransactions, totalAvailable: bundle.recentTransactions.length }, records: recentTransactions.length };
      }
      case 'get_device_history':
        return { tool: name, response: { deviceHistory: bundle.deviceHistory }, records: bundle.deviceHistory.length };
      case 'get_payee_history':
        return { tool: name, response: { payeeHistory: bundle.payeeHistory }, records: bundle.payeeHistory.length };
      case 'get_prior_alerts':
        return { tool: name, response: { priorAlerts: bundle.priorAlerts }, records: bundle.priorAlerts.length };
      case 'get_interventions':
        return { tool: name, response: { interventions: bundle.interventions }, records: bundle.interventions.length };
      case 'get_network_neighbourhood':
        return { tool: name, response: { neighbourhood: bundle.neighbourhood }, records: bundle.neighbourhood.nodes.length };
      case 'inspect_network_entity':
        return this.inspectEntity(args['entityId']);
    }
  }

  /** One node and every edge touching it, each with its index in neighbourhood.nodes / neighbourhood.edges. */
  private inspectEntity(entityId: unknown): ToolResult {
    const tool = 'inspect_network_entity';
    const { nodes, edges } = this.bundle.neighbourhood;
    const nodeIndex = typeof entityId === 'string' ? nodes.findIndex((node) => node.id === entityId) : -1;
    if (nodeIndex < 0) return { tool, response: { error: 'No entity with that id in this neighbourhood.' }, records: 0 };
    const id = nodes[nodeIndex]?.id;
    const touching = edges.flatMap((edge, index) => (edge.from === id || edge.to === id ? [{ path: `neighbourhood.edges[${index}]`, edge }] : []));
    return {
      tool,
      response: { node: { path: `neighbourhood.nodes[${nodeIndex}]`, node: nodes[nodeIndex] }, edges: touching },
      records: 1 + touching.length,
    };
  }
}
