import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { ThemePreferences } from '../../../../core/theme/theme-preferences';
import { readHexToken } from '../../../../shared/ui/canvas/css-color-token';
import { Icon } from '../../../../shared/ui/icon/icon';
import { CanvasGraphRenderer, type GraphPalette, type GraphTarget } from '../../graph-engine/graph-renderer';
import type { PositionedGraphScene } from '../../models/graph-scene';

const DRAG_THRESHOLD_PX = 5;
const WHEEL_ZOOM_PER_PX = 0.0016;
const BUTTON_ZOOM = 1.2;

function paletteFrom(element: Element): GraphPalette {
  const hex = (token: string, fallback: string) => readHexToken(element, token, fallback);
  return {
    text: hex('--sentinel-color-text', '#0f1b2d'),
    textSecondary: hex('--sentinel-color-text-secondary', '#51607a'),
    surface: hex('--sentinel-color-surface', '#ffffff'),
    border: hex('--sentinel-color-border', '#d8e0ec'),
    tones: {
      held: hex('--sentinel-color-critical', '#e2364b'),
      high: hex('--sentinel-color-critical-soft', '#f05a6e'),
      elevated: hex('--sentinel-color-warning', '#e7962a'),
      normal: hex('--sentinel-color-success', '#16a34a'),
      neutral: hex('--sentinel-color-text-muted', '#8a97ab'),
    },
  };
}

/**
 * Hosts the canvas graph: wheel and button zoom about a point, drag to pan, click to select, keyboard focus. A
 * drag never selects. The first frame of every case fits the whole graph; Reset clears focus and re-fits,
 * never the case. One draw per animation frame while visible; nothing runs when the tab is hidden.
 */
@Component({
  selector: 'sentinel-graph-canvas',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'group',
    'aria-roledescription': 'entity graph',
    'aria-label': 'Entity graph. Drag to pan, the wheel or the plus and minus controls to zoom, click an entity or relationship to inspect it.',
  },
  template: `
    <canvas #canvas aria-hidden="true"></canvas>
    @if (tooltip(); as tip) {
      <span class="tooltip" role="status" [style.transform]="'translate(' + tip.x + 'px, ' + tip.y + 'px)'">{{ tip.label }}</span>
    }
    <div class="controls" aria-label="Graph view controls">
      <button type="button" title="Fit to view" aria-label="Fit to view" (click)="fit()"><sentinel-icon name="focus" [size]="18" /></button>
      <button type="button" title="Zoom in" aria-label="Zoom in" (click)="zoomButton(zoomStep)"><sentinel-icon name="plus" [size]="18" /></button>
      <button type="button" title="Zoom out" aria-label="Zoom out" (click)="zoomButton(1 / zoomStep)"><sentinel-icon name="minus" [size]="18" /></button>
      <button type="button" title="Centre on selection" aria-label="Centre on selection" (click)="centreSelection()"><sentinel-icon name="radar" [size]="18" /></button>
      <button type="button" title="Reset view" aria-label="Reset view" (click)="resetRequested.emit()"><sentinel-icon name="expand" [size]="18" /></button>
    </div>
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      min-height: 0;
      overflow: hidden;
      touch-action: none;
    }
    canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      cursor: grab;
    }
    :host([data-dragging]) canvas {
      cursor: grabbing;
    }
    :host([data-hover]) canvas {
      cursor: pointer;
    }
    .controls {
      position: absolute;
      top: 12px;
      right: 12px;
      display: grid;
      gap: 6px;
    }
    .controls button {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      border: 1px solid var(--sentinel-surface-panel-border);
      border-radius: 10px;
      background: var(--sentinel-color-surface);
      color: var(--sentinel-color-accent-text, var(--sentinel-color-accent));
      box-shadow: 0 4px 12px rgba(15, 27, 45, 0.08);
      cursor: pointer;
    }
    .controls button:hover {
      background: var(--sentinel-color-accent-soft);
    }
    .tooltip {
      position: absolute;
      top: 0;
      left: 0;
      z-index: 2;
      padding: 4px 9px;
      border: 1px solid var(--sentinel-surface-panel-border);
      border-radius: 6px;
      background: var(--sentinel-color-surface);
      font-size: 0.75rem;
      font-weight: 600;
      white-space: nowrap;
      pointer-events: none;
    }
  `,
})
export class GraphCanvas {
  readonly scene = input<PositionedGraphScene | null>(null);
  readonly selection = input<GraphTarget | null>(null);
  readonly highlight = input<{ readonly nodes: readonly string[]; readonly edges: readonly string[] } | null>(null);
  /** Changing this value (a new case, or Reset) re-fits the view. */
  readonly framing = input(0);
  readonly selected = output<GraphTarget | null>();
  readonly resetRequested = output<void>();

  protected readonly zoomStep = BUTTON_ZOOM;
  protected readonly tooltip = signal<{ readonly label: string; readonly x: number; readonly y: number } | null>(null);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly theme = inject(ThemePreferences);
  private renderer: CanvasGraphRenderer | null = null;
  private width = 0;
  private height = 0;
  private needsFit = true;
  private framedRoot: string | null = null;
  private requestRender: () => void = () => undefined;

  constructor() {
    const destroyRef = inject(DestroyRef);
    // Each effect reads its signals before touching the renderer, so it re-runs once the renderer exists.
    effect(() => {
      this.theme.appearance();
      this.theme.brand();
      const palette = paletteFrom(this.host.nativeElement);
      this.renderer?.setPalette(palette);
      this.requestRender();
    });
    effect(() => {
      const scene = this.scene();
      this.renderer?.setScene(scene);
      // A different case frames itself; a filter change keeps the analyst's view.
      if (scene && scene.rootId !== this.framedRoot) {
        this.framedRoot = scene.rootId;
        this.needsFit = true;
      }
      this.requestRender();
    });
    effect(() => {
      const selection = this.selection();
      const highlight = this.highlight();
      this.renderer?.setSelection(selection);
      this.renderer?.setHighlight(highlight);
      this.requestRender();
    });
    effect(() => {
      this.framing();
      this.needsFit = true;
      this.requestRender();
    });

    afterNextRender(() => {
      if (typeof ResizeObserver !== 'function') return;
      const canvas = this.canvas().nativeElement;
      const context = canvas.getContext('2d');
      if (!context) return;
      const renderer = new CanvasGraphRenderer(context);
      this.renderer = renderer;
      renderer.setPalette(paletteFrom(this.host.nativeElement));
      renderer.setScene(this.scene());
      renderer.setSelection(this.selection());
      renderer.setHighlight(this.highlight());
      const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

      let frame = 0;
      const loop = (now: number) => {
        frame = 0;
        if (this.width === 0) return;
        if (this.needsFit && this.scene() && this.renderer) {
          renderer.setView(renderer.fitView(this.width, this.height));
          this.needsFit = false;
        }
        renderer.render(this.width, this.height, reducedMotion.matches ? 0 : now);
        if (!reducedMotion.matches && !document.hidden) frame = requestAnimationFrame(loop);
      };
      this.requestRender = () => {
        if (frame === 0 && !document.hidden) frame = requestAnimationFrame(loop);
      };

      const local = (event: PointerEvent | WheelEvent) => {
        const bounds = canvas.getBoundingClientRect();
        return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
      };
      let press: { id: number; x: number; y: number; moved: boolean } | null = null;
      let last = { x: 0, y: 0 };
      const onDown = (event: PointerEvent) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        canvas.setPointerCapture(event.pointerId);
        press = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
        last = { x: event.clientX, y: event.clientY };
      };
      const onMove = (event: PointerEvent) => {
        if (press && press.id === event.pointerId) {
          if (!press.moved && Math.hypot(event.clientX - press.x, event.clientY - press.y) < DRAG_THRESHOLD_PX) return;
          if (!press.moved) {
            press.moved = true;
            this.host.nativeElement.setAttribute('data-dragging', '');
            this.hover(null, 0, 0);
          }
          const view = renderer.getView();
          renderer.setView({ ...view, offsetX: view.offsetX + event.clientX - last.x, offsetY: view.offsetY + event.clientY - last.y });
          last = { x: event.clientX, y: event.clientY };
          this.requestRender();
          return;
        }
        const point = local(event);
        this.hover(renderer.hitTest(point.x, point.y), point.x, point.y);
      };
      const onUp = (event: PointerEvent) => {
        if (!press || press.id !== event.pointerId) return;
        const clicked = !press.moved && event.type === 'pointerup';
        press = null;
        this.host.nativeElement.removeAttribute('data-dragging');
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        if (clicked) {
          const point = local(event);
          this.selected.emit(renderer.hitTest(point.x, point.y));
        }
      };
      const onWheel = (event: WheelEvent) => {
        event.preventDefault();
        const point = local(event);
        renderer.setView(renderer.zoomedView(Math.exp(-event.deltaY * WHEEL_ZOOM_PER_PX), point.x, point.y));
        this.requestRender();
      };
      const onLeave = () => this.hover(null, 0, 0);
      canvas.addEventListener('pointerdown', onDown);
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerup', onUp);
      canvas.addEventListener('pointercancel', onUp);
      canvas.addEventListener('pointerleave', onLeave);
      canvas.addEventListener('wheel', onWheel, { passive: false });

      const resize = new ResizeObserver(([entry]) => {
        if (!entry) return;
        const ratio = Math.min(2, devicePixelRatio || 1);
        const firstSize = this.width === 0;
        this.width = entry.contentRect.width;
        this.height = entry.contentRect.height;
        canvas.width = Math.round(this.width * ratio);
        canvas.height = Math.round(this.height * ratio);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        if (firstSize) this.needsFit = true;
        this.requestRender();
      });
      resize.observe(this.host.nativeElement);
      const onVisibility = () => this.requestRender();
      document.addEventListener('visibilitychange', onVisibility);

      destroyRef.onDestroy(() => {
        cancelAnimationFrame(frame);
        resize.disconnect();
        document.removeEventListener('visibilitychange', onVisibility);
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('pointercancel', onUp);
        canvas.removeEventListener('pointerleave', onLeave);
        canvas.removeEventListener('wheel', onWheel);
        this.renderer = null;
      });
    });
  }

  protected fit(): void {
    if (!this.renderer) return;
    this.renderer.setView(this.renderer.fitView(this.width, this.height));
    this.requestRender();
  }

  protected zoomButton(factor: number): void {
    if (!this.renderer) return;
    this.renderer.setView(this.renderer.zoomedView(factor, this.width / 2, this.height / 2));
    this.requestRender();
  }

  protected centreSelection(): void {
    const selection = this.selection();
    const renderer = this.renderer;
    if (!renderer || !selection) return;
    const scene = this.scene();
    const id = selection.kind === 'node' ? selection.id : scene?.edges.find((edge) => edge.id === selection.id)?.to;
    const at = id ? renderer.screenOf(id) : null;
    if (!at) return;
    const view = renderer.getView();
    renderer.setView({ ...view, offsetX: view.offsetX + this.width / 2 - at.x, offsetY: view.offsetY + this.height / 2 - at.y });
    this.requestRender();
  }

  private hover(target: GraphTarget | null, x: number, y: number): void {
    this.renderer?.setHover(target);
    this.host.nativeElement.toggleAttribute('data-hover', target !== null);
    const scene = this.scene();
    const label = target
      ? target.kind === 'node'
        ? scene?.nodes.find((node) => node.id === target.id)?.label
        : scene?.edges.find((edge) => edge.id === target.id)?.label
      : null;
    this.tooltip.set(label ? { label, x: Math.round(x + 14), y: Math.round(y - 30) } : null);
    this.requestRender();
  }
}
