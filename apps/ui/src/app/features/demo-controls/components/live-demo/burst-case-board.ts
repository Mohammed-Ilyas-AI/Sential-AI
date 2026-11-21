import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import type { ReferenceScenarioKey } from '@sentinel/domain';
import type { BurstTile, BurstTileState } from '../../data-access/burst-board';
import { LiveDemoAutopilot } from '../../data-access/live-demo-autopilot';

/** What each scam pattern is, in one line an audience can read in a second. */
const PATTERN_HINT: Readonly<Record<ReferenceScenarioKey, string>> = {
  phishing: 'Stolen login, new device, drains savings',
  mule: 'Takes in scam money and forwards it',
  smurf: 'Many small transfers to fresh payees',
  replay: 'Reset password, one large transfer',
};

const STATE_LABEL: Readonly<Record<BurstTileState, string>> = {
  QUEUED: 'Waiting',
  LIVE: 'Scoring',
  HELD: 'Held by rules',
  FLAGGED: 'Agents on it',
  CONTAINED: 'Kill switch on',
  MONITORED: 'Monitored',
};

/**
 * The multi-scam burst at a glance: three banks by four scam patterns, each tile following its case live, from the
 * first transfer to the outcome. The summary row says why each outcome happened: the rules hold what breaches
 * SG-RD-50, the agents flag what the gate let through and the analyst approves the kill switch, the rest is watched.
 * Every number is the engine's own; the board only arranges them.
 */
@Component({
  selector: 'sentinel-burst-case-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (demo.board(); as board) {
      <section class="board" [class.compact]="compact()" aria-label="Multi-scam burst case board">
        <header>
          <span class="title"><span class="live" [class.on]="demo.running()" aria-hidden="true"></span> Multi-scam burst · 12 accounts · 3 banks · at once</span>
          <span class="decided" role="status">{{ board.transfers }} transfers decided</span>
          <button type="button" class="toggle" (click)="toggle()" [attr.aria-expanded]="!compact()">{{ compact() ? 'Show board' : 'Minimise' }}</button>
        </header>

        @if (!compact()) {
          <div class="grid" role="table" aria-label="Cases by bank and scam pattern">
            <div class="corner" role="columnheader"></div>
            @for (scenario of board.scenarios; track scenario.key) {
              <div class="col" role="columnheader">
                <b>{{ scenario.name }}</b>
                <span>{{ hint[scenario.key] }}</span>
              </div>
            }
            @for (bank of board.banks; track bank; let row = $index) {
              <div class="bank" role="rowheader">{{ bank }}</div>
              @for (tile of board.tiles.slice(row * 4, row * 4 + 4); track tile.accountDisplayId) {
                <div class="tile" role="cell" [attr.data-state]="tile.state">
                  <span class="top">
                    <span class="acct">{{ tile.accountDisplayId }}</span>
                    @if (tile.notified) {
                      <span class="ping" title="Customer notified" aria-label="Customer notified">📱</span>
                    }
                  </span>
                  <b class="state">
                    @if (tile.state === 'CONTAINED') {
                      <span aria-hidden="true">🛡</span>
                    } @else if (tile.state === 'HELD') {
                      <span aria-hidden="true">⛔</span>
                    }
                    {{ label[tile.state] }}
                  </b>
                  <span class="facts">{{ facts(tile) }}</span>
                </div>
              }
            }
          </div>
        }

        <div class="summary">
          <div data-kind="held">
            <b>{{ board.counts.held }}</b>
            <span><em>Rules held</em> Balance S$50,000 or more and over 50% drained in 24 h: SG-RD-50 stops the transfer before it leaves.</span>
          </div>
          <div data-kind="agents">
            <b>{{ board.counts.flagged + board.counts.contained }}</b>
            <span><em>Agents caught, analyst approved</em> The gate let these through, but the 7 agents see a compromised account and propose a kill switch.</span>
          </div>
          <div data-kind="monitored">
            <b>{{ board.counts.monitored }}</b>
            <span><em>Monitored</em> Low risk: scored and kept in the queue. Nothing is blocked.</span>
          </div>
        </div>
      </section>
    }
  `,
  styles: `
    .board {
      position: fixed;
      z-index: 58;
      top: 74px;
      left: 50%;
      display: grid;
      gap: 10px;
      width: min(860px, calc(100vw - 40px));
      padding: 12px 14px;
      border: 1px solid var(--sentinel-color-accent);
      border-radius: 16px;
      background: color-mix(in srgb, var(--sentinel-color-surface) 97%, transparent);
      color: var(--sentinel-color-text);
      box-shadow: 0 18px 48px rgb(0 0 0 / 28%);
      backdrop-filter: blur(10px);
      transform: translateX(-50%);
      animation: enter 0.35s ease-out;
    }
    header {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .title {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-right: auto;
      font-size: 0.9375rem;
      font-weight: 800;
    }
    .live {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: var(--sentinel-color-text-secondary);
    }
    .live.on {
      background: #ef4444;
      animation: blink 1s steps(2) infinite;
    }
    .decided {
      color: var(--sentinel-color-text-secondary);
      font-size: 0.8125rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .toggle {
      min-height: 28px;
      padding: 0 12px;
      border: 1px solid var(--sentinel-color-border);
      border-radius: 999px;
      background: var(--sentinel-color-surface);
      color: inherit;
      font: inherit;
      font-size: 0.75rem;
      font-weight: 700;
      cursor: pointer;
    }
    .grid {
      display: grid;
      grid-template-columns: 64px repeat(4, minmax(0, 1fr));
      gap: 6px;
    }
    .col {
      display: grid;
      gap: 1px;
      padding: 0 2px 2px;
    }
    .col b {
      font-size: 0.8125rem;
    }
    .col span {
      color: var(--sentinel-color-text-secondary);
      font-size: 0.6875rem;
      line-height: 1.25;
    }
    .bank {
      align-self: center;
      font-size: 0.8125rem;
      font-weight: 800;
    }
    .tile {
      --tone: var(--sentinel-color-text-muted, #8a97ab);
      display: grid;
      gap: 2px;
      min-height: 64px;
      padding: 7px 9px;
      border: 1px solid color-mix(in srgb, var(--tone) 55%, transparent);
      border-radius: 10px;
      background: color-mix(in srgb, var(--tone) 10%, var(--sentinel-color-surface));
      transition:
        background 0.4s ease,
        border-color 0.4s ease,
        box-shadow 0.4s ease;
    }
    .tile[data-state='QUEUED'] {
      border-style: dashed;
      opacity: 0.6;
    }
    .tile[data-state='LIVE'] {
      --tone: var(--sentinel-color-accent);
      animation: scoring 1.2s ease-in-out infinite;
    }
    .tile[data-state='HELD'] {
      --tone: var(--sentinel-color-critical, #e2364b);
      box-shadow: 0 0 14px color-mix(in srgb, var(--tone) 40%, transparent);
    }
    .tile[data-state='FLAGGED'] {
      --tone: var(--sentinel-color-warning, #e7962a);
      animation: scoring 1.6s ease-in-out infinite;
    }
    .tile[data-state='CONTAINED'] {
      --tone: #7c4ddb;
      box-shadow: 0 0 14px color-mix(in srgb, var(--tone) 40%, transparent);
    }
    .tile[data-state='MONITORED'] {
      --tone: var(--sentinel-color-success, #16a34a);
    }
    .top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .acct {
      font-family: var(--sentinel-font-mono, ui-monospace, monospace);
      font-size: 0.6875rem;
      color: var(--sentinel-color-text-secondary);
    }
    .ping {
      font-size: 0.75rem;
      animation: enter 0.35s ease-out;
    }
    .state {
      color: var(--tone);
      font-size: 0.875rem;
    }
    .facts {
      color: var(--sentinel-color-text-secondary);
      font-size: 0.6875rem;
      font-variant-numeric: tabular-nums;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }
    .summary div {
      --tone: var(--sentinel-color-success, #16a34a);
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 7px 10px;
      border-radius: 10px;
      background: color-mix(in srgb, var(--tone) 10%, transparent);
    }
    .summary [data-kind='held'] {
      --tone: var(--sentinel-color-critical, #e2364b);
    }
    .summary [data-kind='agents'] {
      --tone: #7c4ddb;
    }
    .summary b {
      color: var(--tone);
      font-size: 1.5rem;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }
    .summary span {
      color: var(--sentinel-color-text-secondary);
      font-size: 0.6875rem;
      line-height: 1.3;
    }
    .summary em {
      display: block;
      color: var(--sentinel-color-text);
      font-size: 0.75rem;
      font-style: normal;
      font-weight: 800;
    }
    .compact .summary span {
      font-size: 0;
    }
    .compact .summary em {
      font-size: 0.75rem;
    }
    @keyframes enter {
      from {
        opacity: 0;
        transform: translate(-50%, -8px);
      }
    }
    @keyframes scoring {
      50% {
        box-shadow: 0 0 16px color-mix(in srgb, var(--tone) 55%, transparent);
      }
    }
    @keyframes blink {
      50% {
        opacity: 0.2;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .board,
      .tile,
      .ping,
      .live.on {
        animation: none;
      }
    }
    @media (max-width: 760px) {
      .grid {
        grid-template-columns: 48px repeat(4, minmax(0, 1fr));
      }
      .col span,
      .summary span {
        display: none;
      }
    }
  `,
})
export class BurstCaseBoard {
  protected readonly demo = inject(LiveDemoAutopilot);
  protected readonly hint = PATTERN_HINT;
  protected readonly label = STATE_LABEL;
  /** The analyst's own choice wins; otherwise the board steps aside while the tour opens individual cases. */
  private readonly chosen = signal<boolean | null>(null);
  protected readonly compact = computed(() => this.chosen() ?? this.demo.step() === 'BURST_CASES');

  protected toggle(): void {
    this.chosen.set(!this.compact());
  }

  protected facts(tile: BurstTile): string {
    if (tile.state === 'QUEUED') return 'Not started';
    const parts = [`${tile.transfers} ${tile.transfers === 1 ? 'transfer' : 'transfers'}`];
    if (tile.score !== null) parts.push(`${tile.band ?? ''} ${tile.score}`.trim());
    if (tile.drainPct !== null && tile.drainPct > 0) parts.push(`${Math.round(tile.drainPct * 10) / 10}% drained`);
    return parts.join(' · ');
  }
}
