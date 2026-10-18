import type { Contribution, MinorUnits, RiskBand } from '@sentinel/domain';
import type { IconName } from '../../../shared/ui/icon/icon-paths';
import type { GlobeTone } from '../components/operations-globe/globe-renderer';

export type KpiTone = 'accent' | 'critical' | 'warning' | 'success';

/** One headline counter with the shape of its recent history. */
export interface KpiView {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly icon: IconName;
  readonly tone: KpiTone;
  /** Per-bucket values across the tape's time span, oldest first. */
  readonly series: readonly number[];
  /** Later half of the span against the earlier half, in percent; null when there is nothing to compare. */
  readonly changePercent: number | null;
}

export interface GlobeCallout {
  /** The institution marker the callout is pinned to. */
  readonly id: string;
  readonly institution: string;
  readonly amount: MinorUnits;
  readonly label: string;
  readonly detail?: string;
  readonly tone: GlobeTone;
  /** The held transfer a HOLD callout stands for; clicking the callout selects it. */
  readonly transactionId?: string;
  /** The paying account of that held transfer: the callout opens its alert. */
  readonly accountId?: string;
}

/**
 * One open alert on the dashboard, with its transfer's context. `status` is the current intervention state when
 * there is one (a recorded HOLD may since have been RELEASED), else the policy decision, else the risk band.
 */
export interface AttentionItem {
  readonly alertId: string;
  readonly accountId: string;
  readonly account: string;
  readonly transactionId: string;
  readonly route: string | null;
  readonly amount: MinorUnits | null;
  readonly status: string;
  readonly tone: 'held' | 'high' | 'elevated' | 'cleared';
  readonly at: string;
}

export interface NetworkStats {
  readonly banksConnected: number;
  readonly activeRoutes: number;
  readonly accountsMonitored: number;
}

export type StreamStatus = 'ALLOWED' | 'REVIEW' | 'HOLD' | 'REJECT';

export interface StreamRow {
  readonly transactionId: string;
  readonly at: string;
  readonly amount: MinorUnits;
  readonly from: string;
  readonly to: string;
  readonly score: number;
  readonly band: RiskBand;
  readonly status: StreamStatus;
}

export interface ThreatHotspot {
  readonly id: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly level: 'high' | 'elevated' | 'normal';
}

export interface ThreatLandscapeView {
  readonly hotspots: readonly ThreatHotspot[];
  readonly high: number;
  readonly elevated: number;
  readonly normal: number;
}

/** The advisory score of the account in focus and the rules that produced it, as the engine wrote them. */
export interface RiskAnalysisView {
  readonly account: string;
  readonly score: number;
  readonly band: RiskBand;
  readonly contributions: readonly Contribution[];
}

/** The SG-RD-50 outcome for the account in focus: a fact, never a probability. */
export interface PolicyGateView {
  readonly decision: 'ALLOW' | 'HOLD' | 'REJECT';
  readonly drainPct: number;
  readonly gatePercent: number;
  readonly thresholdMet: boolean;
  /** Held by the cascade: an earlier transfer breached the threshold and the account is still in the hold state. */
  readonly cascade: boolean;
  readonly protectedAccount: boolean;
  readonly interventionTitle: string;
  readonly interventionDetail: string;
  /** True when the recorded hold is shorter than an hour: the demo runs 24 hours as 24 seconds (T§4). */
  readonly demoTime: boolean;
}

/**
 * What the globe's detail panel shows for the selected target. Every value is the tape's or the intervention
 * record's own; the policy decision and the current intervention state are always separate fields.
 */
export type GlobeDetail =
  | {
      readonly kind: 'bank';
      readonly id: string;
      readonly label: string;
      readonly focused: boolean;
      readonly transfersOut: number;
      readonly transfersIn: number;
      readonly held: number;
      readonly accounts: number;
    }
  | {
      readonly kind: 'transaction';
      readonly id: string;
      readonly accountId: string;
      readonly account: string;
      readonly from: string;
      readonly to: string;
      readonly amount: MinorUnits;
      readonly score: number;
      readonly band: RiskBand;
      readonly decision: 'ALLOW' | 'HOLD' | 'REJECT';
      readonly reasonCodes: readonly string[];
      readonly interventionState: string | null;
      readonly interventionActor: string | null;
      readonly hasAlert: boolean;
    }
  | {
      readonly kind: 'account';
      readonly id: string;
      readonly account: string;
      readonly institution: string;
      readonly transfers: number;
      readonly latestDecision: 'ALLOW' | 'HOLD' | 'REJECT';
      readonly latestScore: number;
      readonly band: RiskBand;
      readonly hasAlert: boolean;
    };

/** Every action the detail panel offers; each one is a real route or state transition. */
export type GlobeAction =
  | { readonly type: 'focus-bank'; readonly id: string }
  | { readonly type: 'clear-bank' }
  | { readonly type: 'bank-transactions'; readonly id: string }
  | { readonly type: 'open-transaction'; readonly id: string }
  | { readonly type: 'open-alert'; readonly accountId: string }
  | { readonly type: 'open-investigation'; readonly accountId: string };

export type SystemState = 'operational' | 'degraded' | 'offline';

export interface SystemStatusRow {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly state: SystemState;
}
