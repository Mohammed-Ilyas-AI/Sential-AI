import {
  EVIDENCE_RECENT_TRANSACTIONS_CAP,
  GRAPH_EDGE_CAP,
  GRAPH_MAX_HOPS,
  GRAPH_NODE_CAP,
  type EvidenceBundle,
  type GraphNeighbourhood,
} from '@sentinel/domain';
import { ApplicationError } from '../../../platform/errors/application-error.js';
import type { CompileEvidenceBundle } from './compile-evidence-bundle.use-case.js';
import { joinOwnTransfers, ownTransferLinks } from './own-transfer.links.js';
import type { EvidenceSource } from './ports/evidence-source.port.js';

/** Device and payee history beyond this adds cost without adding evidence. */
const SECURITY_HISTORY_CAP = 20;
const PRIOR_ALERTS_CAP = 10;

/** The caps hold whatever the source returns: 40 nodes, 120 edges, and only edges between kept nodes. */
function capped(neighbourhood: GraphNeighbourhood): GraphNeighbourhood {
  const nodes = neighbourhood.nodes.slice(0, GRAPH_NODE_CAP);
  const kept = new Set(nodes.map((node) => node.id));
  const edges = neighbourhood.edges.filter((edge) => kept.has(edge.from) && kept.has(edge.to)).slice(0, GRAPH_EDGE_CAP);
  return {
    ...neighbourhood,
    nodes,
    edges,
    truncated: neighbourhood.truncated || nodes.length < neighbourhood.nodes.length || edges.length < neighbourhood.edges.length,
  };
}

/**
 * Assembles the one typed object Gemini receives (T§7): synthetic identifiers only, the assessment with its
 * contributions[] exactly as recorded, the last 50 transactions, two hops capped at 40 nodes (the account's own
 * transfers, then what the network observed around each destination). Never a dump.
 */
export class EvidenceBundleCompiler implements CompileEvidenceBundle {
  constructor(private readonly evidence: EvidenceSource) {}

  async compile(assessmentId: string): Promise<EvidenceBundle> {
    const recorded = await this.evidence.assessment(assessmentId);
    if (!recorded) throw new ApplicationError('NOT_FOUND', `No assessment ${assessmentId}`);
    const { assessmentId: _id, accountId, rulesetVersion: _ruleset, ...assessment } = recorded;

    const [account, recentTransactions, deviceHistory, payeeHistory, priorAlerts, interventions, neighbourhood] = await Promise.all([
      this.evidence.accountProfile(accountId),
      this.evidence.recentTransactions(accountId, EVIDENCE_RECENT_TRANSACTIONS_CAP),
      this.evidence.deviceHistory(accountId),
      this.evidence.payeeHistory(accountId),
      this.evidence.priorAlerts(accountId),
      this.evidence.interventions(accountId),
      this.evidence.neighbourhood(accountId, GRAPH_MAX_HOPS),
    ]);
    if (!account) throw new ApplicationError('NOT_FOUND', `No account for assessment ${assessmentId}`);

    // Hop 1 is where this account's own money went; hop 2 is what the network observed around each destination.
    const links = ownTransferLinks(accountId, recentTransactions);
    const destinationNeighbourhoods = await Promise.all(links.map((link) => this.evidence.neighbourhood(link.destinationId, 1)));

    return {
      account,
      assessment,
      drain: assessment.drain,
      recentTransactions: recentTransactions.slice(0, EVIDENCE_RECENT_TRANSACTIONS_CAP),
      deviceHistory: deviceHistory.slice(0, SECURITY_HISTORY_CAP),
      payeeHistory: payeeHistory.slice(0, SECURITY_HISTORY_CAP),
      priorAlerts: priorAlerts.slice(0, PRIOR_ALERTS_CAP),
      interventions,
      neighbourhood: capped(joinOwnTransfers(account, neighbourhood, links, destinationNeighbourhoods)),
    };
  }
}
