import type { IconName } from '../../shared/ui/icon/icon-paths';
import type { TapeRow } from '../../workers/transaction-worker-protocol';

export type PaletteGroup = 'Accounts' | 'Transactions' | 'Navigate' | 'Workspace';

/** One thing the palette can do. `run` is bound by the palette; this file only describes and ranks. */
export interface PaletteCommand {
  readonly id: string;
  readonly group: PaletteGroup;
  readonly label: string;
  readonly hint?: string;
  readonly icon: IconName;
  readonly keywords: string;
  readonly action:
    | { readonly kind: 'navigate'; readonly route: string }
    | { readonly kind: 'focus-account'; readonly accountId: string }
    | { readonly kind: 'open-settings' }
    | { readonly kind: 'toggle-sidebar' }
    | { readonly kind: 'toggle-focus-mode' };
}

export const STATIC_COMMANDS: readonly PaletteCommand[] = [
  { id: 'open-alerts', group: 'Navigate', label: 'Open alert queue', icon: 'alert', keywords: 'alerts queue cases', action: { kind: 'navigate', route: '/alerts' } },
  { id: 'open-investigations', group: 'Navigate', label: 'Open investigations', icon: 'investigate', keywords: 'investigate evidence', action: { kind: 'navigate', route: '/investigations' } },
  { id: 'open-network', group: 'Navigate', label: 'Open network analysis', icon: 'network', keywords: 'graph mule entity', action: { kind: 'navigate', route: '/network-analysis' } },
  { id: 'open-cases', group: 'Navigate', label: 'Open cases', icon: 'audit', keywords: 'case report', action: { kind: 'navigate', route: '/cases' } },
  { id: 'open-policy', group: 'Navigate', label: 'Open policy & rules', icon: 'policy', keywords: 'sg-rd-50 rapid drain rules', action: { kind: 'navigate', route: '/policy' } },
  { id: 'open-tower', group: 'Navigate', label: 'Open control tower', icon: 'radar', keywords: 'home dashboard', action: { kind: 'navigate', route: '/control-tower' } },
  { id: 'open-settings', group: 'Workspace', label: 'Open settings', icon: 'settings', keywords: 'preferences theme', action: { kind: 'open-settings' } },
  { id: 'toggle-sidebar', group: 'Workspace', label: 'Toggle sidebar', icon: 'chevronsLeft', hint: 'Ctrl B', keywords: 'navigation rail collapse', action: { kind: 'toggle-sidebar' } },
  { id: 'toggle-focus', group: 'Workspace', label: 'Toggle focus mode', icon: 'focus', keywords: 'distraction hide', action: { kind: 'toggle-focus-mode' } },
];

const RESULT_LIMIT = 5;

/** Accounts and transactions already on the analyst's tape; the palette never queries the server itself. */
export function recordCommands(query: string, rows: readonly TapeRow[]): readonly PaletteCommand[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];
  const accounts = new Map<string, TapeRow>();
  for (const row of rows) {
    const reference = (row.accountReference ?? row.accountId).toLowerCase();
    if ((reference.includes(needle) || row.accountId.toLowerCase().includes(needle)) && !accounts.has(row.accountId)) {
      accounts.set(row.accountId, row);
    }
  }
  const accountCommands = [...accounts.values()].slice(0, RESULT_LIMIT).map(
    (row): PaletteCommand => ({
      id: `account:${row.accountId}`,
      group: 'Accounts',
      label: row.accountReference ?? row.accountId,
      hint: `score ${row.score} · ${row.band.toLowerCase()}`,
      icon: 'account',
      keywords: '',
      action: { kind: 'focus-account', accountId: row.accountId },
    }),
  );
  const transactionCommands = rows
    .filter((row) => row.transactionId.toLowerCase().includes(needle))
    .slice(0, RESULT_LIMIT)
    .map(
      (row): PaletteCommand => ({
        id: `transaction:${row.transactionId}`,
        group: 'Transactions',
        label: row.transactionId,
        hint: `${row.decision} · ${row.accountReference ?? row.accountId}`,
        icon: 'transfer',
        keywords: '',
        action: { kind: 'focus-account', accountId: row.accountId },
      }),
    );
  return [...accountCommands, ...transactionCommands];
}

export function matchingStaticCommands(query: string): readonly PaletteCommand[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return STATIC_COMMANDS;
  return STATIC_COMMANDS.filter((command) => `${command.label} ${command.keywords}`.toLowerCase().includes(needle));
}
