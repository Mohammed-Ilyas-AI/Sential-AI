import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SCENE_SIZE } from '../../data-access/network-analysis-facade';
import type { PositionedGraphScene } from '../../models/graph-scene';

const KIND_GLYPH = { ACCOUNT: 'A', PAYEE: 'P', DEVICE: 'D', INSTITUTION: 'B' } as const;

/**
 * SVG rendering of the neighbourhood. Flagged nodes carry a ring and a "!" mark, never colour alone; links that
 * may not score (candidate or unobserved) are dashed. Every node is a keyboard-reachable button.
 */
@Component({
  selector: 'sentinel-graph-canvas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.viewBox]="'0 0 ' + size.width + ' ' + size.height" role="group" aria-label="Entity network, two hops from the account">
      <ellipse class="ring" [attr.cx]="size.width / 2" [attr.cy]="size.height / 2" rx="150" [attr.ry]="150 * 0.82" />
      <ellipse class="ring" [attr.cx]="size.width / 2" [attr.cy]="size.height / 2" rx="245" [attr.ry]="245 * 0.82" />
      @for (edge of scene().edges; track edge.id) {
        <line
          [attr.x1]="scene().positions[edge.from]?.x" [attr.y1]="scene().positions[edge.from]?.y"
          [attr.x2]="scene().positions[edge.to]?.x" [attr.y2]="scene().positions[edge.to]?.y"
          [class.money]="edge.kind === 'TRANSFERRED_TO'"
          [class.weak]="edge.evidence.scoring === 'CANDIDATE' || edge.evidence.scoring === 'NONE'"
          [class.active]="edge.from === selectedId() || edge.to === selectedId()"
        ><title>{{ edge.kind }} · {{ edge.evidence.linkage }} · {{ edge.evidence.scoring }}</title></line>
      }
      @for (node of scene().nodes; track node.id) {
        <g
          class="node"
          tabindex="0"
          role="button"
          [attr.aria-label]="node.kind + ' ' + node.id + (node.flagged ? ', flagged' : '')"
          [attr.aria-pressed]="node.id === selectedId()"
          [attr.transform]="'translate(' + scene().positions[node.id]?.x + ',' + scene().positions[node.id]?.y + ')'"
          [attr.data-kind]="node.kind"
          [class.root]="node.id === scene().rootId"
          [class.flagged]="node.flagged"
          [class.selected]="node.id === selectedId()"
          (click)="selected.emit(node.id)"
          (keydown.enter)="selected.emit(node.id)"
        >
          @if (node.flagged) {
            <circle class="halo" r="22" />
          }
          <circle class="dot" [attr.r]="node.id === scene().rootId ? 18 : 13" />
          <text class="glyph" dy="4">{{ glyph[node.kind] }}</text>
          @if (node.flagged) {
            <text class="mark" x="12" y="-12">!</text>
          }
          <text class="label" [attr.dy]="node.id === scene().rootId ? 34 : 28">{{ node.label }}</text>
        </g>
      }
    </svg>
  `,
  styles: `
    :host { display: block; }
    svg { width: 100%; height: auto; display: block; }
    .ring { fill: none; stroke: var(--sentinel-color-border-soft); stroke-dasharray: 2 6; }
    line { stroke: var(--sentinel-color-border); stroke-width: 1.5; }
    line.money { stroke: var(--sentinel-color-series); stroke-width: 2; }
    line.weak { stroke-dasharray: 5 5; opacity: 0.7; }
    line.active { stroke: var(--sentinel-color-accent); stroke-width: 2.5; }
    .node { cursor: pointer; outline: none; }
    .dot { fill: var(--sentinel-color-elevated); stroke: var(--sentinel-color-border); stroke-width: 2; }
    .node[data-kind='ACCOUNT'] .dot { stroke: var(--sentinel-color-series); }
    .node[data-kind='DEVICE'] .dot { stroke: var(--sentinel-color-info); }
    .node[data-kind='PAYEE'] .dot { stroke: var(--sentinel-color-warning); }
    .node.root .dot { fill: color-mix(in srgb, var(--sentinel-color-series) 30%, var(--sentinel-color-elevated)); stroke-width: 3; }
    .node.flagged .dot { stroke: var(--sentinel-color-hold); }
    .halo { fill: none; stroke: var(--sentinel-color-hold); stroke-width: 1.5; stroke-dasharray: 3 3; }
    .node.selected .dot, .node:focus-visible .dot { stroke: var(--sentinel-color-accent); stroke-width: 3.5; }
    .glyph { fill: var(--sentinel-color-text); font-size: 11px; font-weight: 600; text-anchor: middle; pointer-events: none; }
    .mark { fill: var(--sentinel-color-hold); font-size: 14px; font-weight: 700; pointer-events: none; }
    .label { fill: var(--sentinel-color-text-secondary); font-family: var(--sentinel-font-family-mono); font-size: 10px; text-anchor: middle; pointer-events: none; }
  `,
})
export class GraphCanvas {
  readonly scene = input.required<PositionedGraphScene>();
  readonly selectedId = input<string | null>(null);
  readonly selected = output<string>();
  protected readonly size = SCENE_SIZE;
  protected readonly glyph = KIND_GLYPH;
}
