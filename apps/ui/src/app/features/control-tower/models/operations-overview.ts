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
  readonly protectedAccount: boolean;
  readonly interventionTitle: string;
  readonly interventionDetail: string;
}

export type SystemState = 'operational' | 'degraded' | 'offline';

export interface SystemStatusRow {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly state: SystemState;
}
