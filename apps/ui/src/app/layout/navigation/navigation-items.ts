import type { IconName } from '../../shared/ui/icon/icon-paths';

export type NavigationSection = 'primary' | 'secondary' | 'system';

export interface NavigationItem {
  readonly id: string;
  readonly label: string;
  readonly icon: IconName;
  readonly section: NavigationSection;
  /** A route to open, or an in-shell surface to show instead. */
  readonly route?: string;
  readonly opens?: 'settings';
  /** Shown in the mobile bottom bar, in this order; everything else lives in the "More" sheet. */
  readonly mobileSlot?: number;
  readonly mobileLabel?: string;
}

/** Curated: twelve destinations. Adding one is a product decision, not a layout one. */
export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  { id: 'control-tower', label: 'Control Tower', icon: 'radar', section: 'primary', route: '/control-tower', mobileSlot: 1 },
  { id: 'live-transactions', label: 'Live Transactions', icon: 'activity', section: 'primary', route: '/live-transactions' },
  { id: 'alerts', label: 'Alerts & Cases', icon: 'alert', section: 'primary', route: '/alerts', mobileSlot: 4, mobileLabel: 'Cases' },
  { id: 'investigations', label: 'Investigations', icon: 'investigate', section: 'primary', route: '/investigations', mobileSlot: 2 },
  { id: 'network-analysis', label: 'Network Analysis', icon: 'network', section: 'primary', route: '/network-analysis', mobileSlot: 3, mobileLabel: 'Network' },
  { id: 'accounts', label: 'Accounts', icon: 'account', section: 'primary', route: '/accounts' },
  { id: 'interventions', label: 'Interventions', icon: 'intervention', section: 'primary', route: '/interventions' },
  { id: 'policy', label: 'Policy & Rules', icon: 'policy', section: 'secondary', route: '/policy' },
  { id: 'analytics', label: 'Analytics & Reports', icon: 'analytics', section: 'secondary', route: '/analytics' },
  { id: 'integrations', label: 'Integrations', icon: 'integrations', section: 'system', route: '/integrations' },
  { id: 'audit-logs', label: 'Audit Logs', icon: 'audit', section: 'system', route: '/audit-logs' },
  { id: 'settings', label: 'Settings', icon: 'settings', section: 'system', opens: 'settings' },
];

export const NAVIGATION_SECTIONS: readonly { readonly section: NavigationSection; readonly label: string | null }[] = [
  { section: 'primary', label: null },
  { section: 'secondary', label: null },
  { section: 'system', label: 'System' },
];

export const MOBILE_BOTTOM_ITEMS: readonly NavigationItem[] = NAVIGATION_ITEMS.filter((item) => item.mobileSlot !== undefined).sort(
  (left, right) => (left.mobileSlot ?? 0) - (right.mobileSlot ?? 0),
);
