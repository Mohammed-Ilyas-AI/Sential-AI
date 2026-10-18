import type { EdgeEvidence, EvidenceBundle, GraphEdgeKind, Intervention, NodeKind, RiskBand } from '@sentinel/domain';
import type { TapeRow } from '../../../workers/transaction-worker-protocol';
import type { GraphScene, GraphSceneEdge, GraphSceneNode, GraphTone, GraphTransfer } from '../models/graph-scene';

/** One moment of the case on the timeline, with the graph elements it touched. */
export interface GraphTimelineEntry {
  readonly id: string;
  readonly at: string;
  readonly kind: 'TRANSFER' | 'DEVICE' | 'PAYEE' | 'INTERVENTION';
  readonly title: string;
  readonly detail: string;
  readonly amount: number | null;
  readonly tone: GraphTone;
  readonly nodeIds: readonly string[];
  readonly edgeIds: readonly string[];
}

/** Token ids are long; the canvas shows the kind and the last eight characters. The inspector shows them whole. */
export const shortId = (kind: 'account' | 'payee' | 'device', id: string): string => (id.length > 14 ? `${kind} …${id.slice(-8)}` : id);

export const institutionName = (id: string): string => {
  const synthetic = /^BANK_([A-Z])$/.exec(id);
  return synthetic ? `Bank ${synthetic[1]}` : id;
};

const RANK: Readonly<Record<GraphTone, number>> = { neutral: 0, normal: 1, elevated: 2, high: 3, held: 4 };
const worst = (tones: readonly GraphTone[], fallback: GraphTone): GraphTone =>
  tones.reduce((current, tone) => (RANK[tone] > RANK[current] ? tone : current), fallback);

const toneOfBand = (band: RiskBand): GraphTone => (band === 'CRITICAL' || band === 'HIGH' ? 'high' : band === 'ELEVATED' ? 'elevated' : 'normal');

function toneOfTransfer(transfer: GraphTransfer): GraphTone {
  if (transfer.intervention === 'HELD' || transfer.intervention === 'REJECTED') return 'held';
  if (!transfer.decided) return 'neutral';
  if (transfer.decided.decision !== 'ALLOW' && !transfer.intervention) return 'held';
  return toneOfBand(transfer.decided.band);
}

const money = (minor: number): string => `S$${(minor / 100).toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * The case's entity graph from the evidence bundle exactly as sentinel-core compiled it: the core's own
 * two-hop neighbourhood, plus the relationships its records establish for the account in focus — every transfer
 * (to its destination account and institution, through its payee, from its device), new-device and payee
 * registration events, and the interventions on those transfers. Nothing is inferred beyond those records, and
 * every edge carries the evidence it came from. Deterministic: the same bundle gives the same ids and order.
 */
export function buildEvidenceGraph(
  evidence: EvidenceBundle,
  tape: ReadonlyMap<string, TapeRow>,
  accountReference: string | null,
): { readonly scene: GraphScene; readonly timeline: readonly GraphTimelineEntry[] } {
  const root = evidence.account.accountId;
  const own = evidence.account.institutionId;
  const nodes = new Map<string, GraphSceneNode>();
  const edges = new Map<string, GraphSceneEdge>();
  const addNode = (node: GraphSceneNode) => {
    if (!nodes.has(node.id)) nodes.set(node.id, node);
  };
  const ownEvidence = (evidenceType: EdgeEvidence['evidenceType'], observedAt: string, sourceInstitution = own): EdgeEvidence => ({
    sourceInstitution,
    evidenceType,
    observedAt,
    tenantScope: 'OWN',
    linkage: 'DIRECT',
    scoring: 'CONFIRMED',
  });

  // Interventions: the latest state per transfer.
  const latestIntervention = new Map<string, Intervention>();
  for (const intervention of [...evidence.interventions].sort((a, b) => a.actedAt.localeCompare(b.actedAt))) {
    latestIntervention.set(intervention.transactionId, intervention);
  }

  const transfers: GraphTransfer[] = [...evidence.recentTransactions]
    .sort((a, b) => a.ts.localeCompare(b.ts))
    .map((transaction) => {
      const row = tape.get(transaction.id);
      const intervention = latestIntervention.get(transaction.id);
      return {
        id: transaction.id,
        at: transaction.ts,
        amount: transaction.amount,
        from: transaction.sourceAccountId,
        to: transaction.destAccountId,
        payeeId: transaction.payeeId,
        deviceId: transaction.deviceId,
        destInstitutionId: transaction.destInstitutionId,
        ...(row ? { decided: { score: row.score, band: row.band, decision: row.decision } } : {}),
        ...(intervention ? { intervention: intervention.state } : {}),
      };
    });

  const rootRow = tape.get(evidence.assessment.transactionId);
  const rootTone: GraphTone =
    rootRow && rootRow.decision !== 'ALLOW' && latestIntervention.get(rootRow.transactionId)?.state !== 'RELEASED'
      ? 'held'
      : toneOfBand(evidence.assessment.band);
  addNode({
    id: root,
    kind: 'ACCOUNT',
    label: accountReference ?? root,
    caption: `${institutionName(own)} · score ${evidence.assessment.score}`,
    tone: rootTone,
    root: true,
    flagged: evidence.assessment.band === 'HIGH' || evidence.assessment.band === 'CRITICAL',
    flags: evidence.assessment.contributions.filter((contribution) => contribution.points > 0).map((contribution) => contribution.label),
    unobserved: false,
    institutionId: own,
  });
  addNode({ id: `inst:${own}`, kind: 'INSTITUTION', label: institutionName(own), caption: 'Account holder', tone: 'neutral', root: false, flagged: false, flags: [], unobserved: false, institutionId: own });
  edges.set(`held:${root}`, {
    id: `held:${root}`,
    from: root,
    to: `inst:${own}`,
    kind: 'HELD_AT',
    tone: 'neutral',
    label: 'Held at',
    evidence: ownEvidence('PAYMENT_EVENT', evidence.account.openedAt),
    transfers: [],
    firstSeen: evidence.account.openedAt,
    lastSeen: evidence.account.openedAt,
    weight: 1,
  });

  const newDevices = new Set(evidence.deviceHistory.filter((event) => event.eventType === 'NEW_DEVICE').map((event) => event.deviceId));
  const addedPayees = new Set(evidence.payeeHistory.map((event) => event.payeeId));

  const link = (id: string, from: string, to: string, kind: GraphEdgeKind, transfer: GraphTransfer | null, evidenceType: EdgeEvidence['evidenceType'], at: string) => {
    const existing = edges.get(id);
    const ids = transfer ? [...(existing?.transfers ?? []), transfer.id] : (existing?.transfers ?? []);
    edges.set(id, {
      id,
      from,
      to,
      kind,
      tone: 'neutral',
      label: '',
      evidence: existing?.evidence ?? ownEvidence(evidenceType, at),
      transfers: ids,
      firstSeen: existing?.firstSeen ?? at,
      lastSeen: at,
      weight: (existing?.weight ?? 0) + (transfer && kind === 'TRANSFERRED_TO' ? transfer.amount : 1),
    });
  };

  for (const transfer of transfers) {
    const account = transfer.to;
    addNode({ id: account, kind: 'ACCOUNT', label: shortId('account', account), caption: `Account · ${institutionName(transfer.destInstitutionId)}`, tone: 'neutral', root: false, flagged: false, flags: [], unobserved: false, institutionId: transfer.destInstitutionId });
    addNode({ id: `inst:${transfer.destInstitutionId}`, kind: 'INSTITUTION', label: institutionName(transfer.destInstitutionId), caption: 'Receiving institution', tone: 'neutral', root: false, flagged: false, flags: [], unobserved: false, institutionId: transfer.destInstitutionId });
    link(`transfer:${root}>${account}`, root, account, 'TRANSFERRED_TO', transfer, 'PAYMENT_EVENT', transfer.at);
    link(`held:${account}`, account, `inst:${transfer.destInstitutionId}`, 'HELD_AT', null, 'PAYMENT_EVENT', transfer.at);
    if (transfer.payeeId) {
      const isNew = addedPayees.has(transfer.payeeId);
      addNode({ id: transfer.payeeId, kind: 'PAYEE', label: shortId('payee', transfer.payeeId), caption: isNew ? 'Beneficiary · newly added' : 'Beneficiary', tone: isNew ? 'elevated' : 'neutral', root: false, flagged: isNew, flags: isNew ? ['new payee'] : [], unobserved: false });
      link(`payee:${root}>${transfer.payeeId}`, root, transfer.payeeId, 'PAYEE_OF', transfer, 'BENEFICIARY_MATCH', transfer.at);
      link(`resolves:${transfer.payeeId}>${account}`, transfer.payeeId, account, 'PAYEE_OF', transfer, 'BENEFICIARY_MATCH', transfer.at);
    }
    if (transfer.deviceId) {
      const isNew = newDevices.has(transfer.deviceId);
      addNode({ id: transfer.deviceId, kind: 'DEVICE', label: shortId('device', transfer.deviceId), caption: isNew ? 'Device · new to account' : 'Device', tone: isNew ? 'elevated' : 'neutral', root: false, flagged: isNew, flags: isNew ? ['new device'] : [], unobserved: false });
      link(`device:${root}>${transfer.deviceId}`, root, transfer.deviceId, 'USED_DEVICE', transfer, 'AUTH_EVENT', transfer.at);
    }
  }
  // Devices and payees registered without a transfer yet are still part of the case.
  for (const event of evidence.deviceHistory) {
    addNode({ id: event.deviceId, kind: 'DEVICE', label: shortId('device', event.deviceId), caption: event.eventType === 'NEW_DEVICE' ? 'Device · new to account' : 'Device', tone: newDevices.has(event.deviceId) ? 'elevated' : 'neutral', root: false, flagged: newDevices.has(event.deviceId), flags: newDevices.has(event.deviceId) ? ['new device'] : [], unobserved: false });
    if (!edges.has(`device:${root}>${event.deviceId}`)) link(`device:${root}>${event.deviceId}`, root, event.deviceId, 'USED_DEVICE', null, 'AUTH_EVENT', event.occurredAt);
  }
  for (const event of evidence.payeeHistory) {
    addNode({ id: event.payeeId, kind: 'PAYEE', label: shortId('payee', event.payeeId), caption: 'Beneficiary · newly added', tone: 'elevated', root: false, flagged: true, flags: ['new payee'], unobserved: false });
    if (!edges.has(`payee:${root}>${event.payeeId}`)) link(`payee:${root}>${event.payeeId}`, root, event.payeeId, 'PAYEE_OF', null, 'BENEFICIARY_MATCH', event.occurredAt);
  }

  // The core's own neighbourhood, when it has one: its evidence (including candidate and unobserved links) wins.
  const kindLabel: Readonly<Record<NodeKind, string>> = { ACCOUNT: 'Account', PAYEE: 'Beneficiary', DEVICE: 'Device', INSTITUTION: 'Institution' };
  for (const node of evidence.neighbourhood.nodes) {
    addNode({
      id: node.id,
      kind: node.kind,
      label: node.kind === 'INSTITUTION' && node.institutionId ? institutionName(node.institutionId) : node.id,
      caption: node.institutionId ? `${kindLabel[node.kind]} · ${institutionName(node.institutionId)}` : kindLabel[node.kind],
      tone: node.flagged ? 'high' : 'neutral',
      root: false,
      flagged: node.flagged,
      flags: node.riskIndicators.map((indicator) => indicator.replaceAll('_', ' ').toLowerCase()),
      unobserved: false,
      ...(node.institutionId ? { institutionId: node.institutionId } : {}),
    });
  }
  for (const edge of evidence.neighbourhood.edges) {
    const id = `net:${edge.kind}:${edge.from}>${edge.to}`;
    for (const end of [edge.from, edge.to]) {
      if (!nodes.has(end)) addNode({ id: end, kind: 'ACCOUNT', label: end, caption: 'Unobserved downstream', tone: 'neutral', root: false, flagged: false, flags: [], unobserved: true });
    }
    edges.set(id, { id, from: edge.from, to: edge.to, kind: edge.kind, tone: 'neutral', label: '', evidence: edge.evidence, transfers: [], firstSeen: edge.firstSeen, lastSeen: edge.lastSeen, weight: edge.weight });
  }

  // Tones and labels from the transfers each element carries.
  const byId = new Map(transfers.map((transfer) => [transfer.id, transfer]));
  const finished = [...edges.values()].map((edge): GraphSceneEdge => {
    const own = edge.transfers.map((id) => byId.get(id)).filter((transfer): transfer is GraphTransfer => !!transfer);
    const tone = worst(own.map(toneOfTransfer), edge.evidence.scoring === 'CANDIDATE' || edge.evidence.scoring === 'NONE' ? 'neutral' : 'normal');
    const count = own.length;
    const label =
      edge.kind === 'TRANSFERRED_TO'
        ? `${count} ${count === 1 ? 'transfer' : 'transfers'} · ${money(edge.weight)}`
        : edge.kind === 'USED_DEVICE'
          ? count > 0 ? `Used on · ${count}` : 'Used on'
          : edge.kind === 'HELD_AT'
            ? 'Held at'
            : edge.from === root
              ? 'Beneficiary of'
              : 'Pays into';
    return { ...edge, tone: edge.kind === 'HELD_AT' ? 'neutral' : tone, label: edge.evidence.scoring === 'CANDIDATE' ? `${label} (candidate)` : label };
  });
  for (const edge of finished) {
    if (edge.kind !== 'TRANSFERRED_TO') continue;
    const target = nodes.get(edge.to);
    if (target && !target.root) {
      const flagged = edge.tone === 'held' || edge.tone === 'high';
      nodes.set(edge.to, { ...target, tone: edge.tone, flagged: target.flagged || flagged, flags: flagged ? [...target.flags, edge.tone === 'held' ? 'received held transfer' : 'received high-risk transfer'] : target.flags });
    }
  }

  const timeline: GraphTimelineEntry[] = [
    ...transfers.map((transfer) => ({
      id: `t:${transfer.id}`,
      at: transfer.at,
      kind: 'TRANSFER' as const,
      title: money(transfer.amount),
      detail: `${institutionName(own)} → ${institutionName(transfer.destInstitutionId)}`,
      amount: transfer.amount,
      tone: toneOfTransfer(transfer),
      nodeIds: [root, transfer.to, transfer.payeeId, transfer.deviceId].filter(Boolean),
      edgeIds: [`transfer:${root}>${transfer.to}`, `payee:${root}>${transfer.payeeId}`, `resolves:${transfer.payeeId}>${transfer.to}`, `device:${root}>${transfer.deviceId}`],
    })),
    ...evidence.deviceHistory.map((event, index) => ({
      id: `d:${event.deviceId}:${index}`,
      at: event.occurredAt,
      kind: 'DEVICE' as const,
      title: event.eventType === 'NEW_DEVICE' ? 'New device' : event.eventType.replaceAll('_', ' ').toLowerCase(),
      detail: event.deviceId,
      amount: null,
      tone: (event.eventType === 'NEW_DEVICE' ? 'elevated' : 'neutral') as GraphTone,
      nodeIds: [root, event.deviceId],
      edgeIds: [`device:${root}>${event.deviceId}`],
    })),
    ...evidence.payeeHistory.map((event, index) => ({
      id: `p:${event.payeeId}:${index}`,
      at: event.occurredAt,
      kind: 'PAYEE' as const,
      title: 'Payee added',
      detail: event.payeeId,
      amount: null,
      tone: 'elevated' as GraphTone,
      nodeIds: [root, event.payeeId],
      edgeIds: [`payee:${root}>${event.payeeId}`],
    })),
    ...evidence.interventions.map((intervention) => {
      const transfer = byId.get(intervention.transactionId);
      return {
        id: `i:${intervention.id}`,
        at: intervention.actedAt,
        kind: 'INTERVENTION' as const,
        title: intervention.state === 'HELD' ? 'Held' : intervention.state.charAt(0) + intervention.state.slice(1).toLowerCase(),
        detail: `${intervention.actor.toLowerCase()} · ${intervention.transactionId}`,
        amount: null,
        tone: (intervention.state === 'HELD' || intervention.state === 'REJECTED' ? 'held' : 'normal') as GraphTone,
        nodeIds: transfer ? [root, transfer.to] : [root],
        edgeIds: transfer ? [`transfer:${root}>${transfer.to}`] : [],
      };
    }),
  ].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));

  return {
    scene: { rootId: root, nodes: [...nodes.values()], edges: finished, transfers, truncated: evidence.neighbourhood.truncated },
    timeline,
  };
}
