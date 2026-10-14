import type { IconName } from '../../shared/ui/icon/icon-paths';

/** What a workspace will do, and what already backs it today. Shown until the workspace itself ships. */
export interface ModuleOverview {
  readonly title: string;
  readonly icon: IconName;
  readonly summary: string;
  readonly capabilities: readonly string[];
  readonly availableNow: string;
}

export const MODULE_CATALOGUE = {
  accounts: {
    title: 'Accounts',
    icon: 'account',
    summary: 'Every protected account with its rolling 24-hour window, balance at window start and security posture.',
    capabilities: ['Drain against the SG-RD-50 line per account', 'Known devices, payees and cooling-off state', 'Decision and hold history'],
    availableNow: 'Account focus, drain state and timeline are live in the control tower.',
  },
  interventions: {
    title: 'Interventions',
    icon: 'intervention',
    summary: 'The append-only record of every hold and what ended it: auto-release, customer verification, cancellation or confirmed fraud.',
    capabilities: ['Held transactions with time to auto-release', 'Customer-verified release and cancellation', 'Fraud confirmation with analyst identity'],
    availableNow: 'The intervention API and live hold state are working; this workspace adds the analyst actions.',
  },
  policy: {
    title: 'Policy & rules',
    icon: 'policy',
    summary: 'The published SG-RD-50 rapid-drain control and the seven advisory rules, with their versions.',
    capabilities: ['Protected balance, gate percentage, window and hold duration', 'Rule codes, maxima and curves', 'Policy and ruleset version history'],
    availableNow: 'Every decision already carries its policy and ruleset version in the decision trace.',
  },
  analytics: {
    title: 'Analytics & reports',
    icon: 'analytics',
    summary: 'Measured outcomes of the control: holds, releases, value protected and latency against budget.',
    capabilities: ['Holds and outcomes over time', 'Value held and released', 'Control-path latency against the 500 ms budget'],
    availableNow: 'Live counters are on the control tower.',
  },
  integrations: {
    title: 'Integrations',
    icon: 'integrations',
    summary: 'How participating institutions connect: the decision API, security events, account reports and the Pub/Sub lifecycle feed.',
    capabilities: ['Per-institution connection health', 'Push subscription status', 'Event throughput and rejections'],
    availableNow: 'The simulator plays Bank A, Bank B and Bank C over the same contracts a bank would use.',
  },
  'audit-logs': {
    title: 'Audit logs',
    icon: 'audit',
    summary: 'Who decided what, when, and under which policy version, reproducible months later.',
    capabilities: ['Decisions with trace IDs', 'Intervention transitions with actor', 'Export for review'],
    availableNow: 'Decisions and interventions are persisted append-only in MongoDB today.',
  },
} as const satisfies Record<string, ModuleOverview>;

export type ModuleId = keyof typeof MODULE_CATALOGUE;
