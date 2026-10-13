import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { MinorUnitsCurrencyPipe } from '../../../../shared/pipes/minor-units-currency/minor-units-currency-pipe';
import { Icon } from '../../../../shared/ui/icon/icon';
import { landDots } from '../../geo/land-mask';
import type { GlobeCallout } from '../../models/operations-overview';
import { GlobeRenderer, type GlobeScene } from './globe-renderer';

const DOT_LATTICE_SIZE = 26_000;
/** One autonomous revolution; slow enough to be felt rather than watched. */
const ROTATION_PERIOD_MS = 150_000;
const START_LONGITUDE = -18;
const TILT_DEGREES = 18;
/** Below this globe width only the held-transfer callout is shown, so callouts never collide. */
const COMPACT_WIDTH_PX = 480;
/** Space between a marker and its callout. */
const CALLOUT_GAP = 14;
/** How quickly a drag offset relaxes back into autonomous rotation, per frame. */
const RELAX = 0.035;

/**
 * The live global network: the renderer draws, this component owns time, pointer, zoom and the HTML callouts.
 * One draw per animation frame, paused off-screen or hidden, and a single still frame under reduced motion.
 */
@Component({
  selector: 'sentinel-operations-globe',
  imports: [Icon, MinorUnitsCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <canvas #canvas aria-hidden="true"></canvas>
    <div class="callouts">
      @for (callout of callouts(); track callout.id) {
        <div class="callout" [attr.data-id]="callout.id" [attr.data-tone]="callout.tone">
          <span class="tile"><sentinel-icon [name]="callout.tone === 'held' ? 'alert' : 'bank'" [size]="18" /></span>
          <span class="text">
            @if (callout.tone !== 'held') {
              <span class="bank">{{ callout.institution }}</span>
            }
            <span class="amount sentinel-mono">{{ callout.amount | minorUnitsCurrency }}</span>
            <span class="label">{{ callout.label }}</span>
            @if (callout.detail) {
              <span class="detail">{{ callout.detail }}</span>
            }
          </span>
        </div>
      }
    </div>
    <p class="sentinel-visually-hidden">{{ description() }}</p>
  `,
  styleUrl: './operations-globe.css',
})
export class OperationsGlobe {
  readonly scene = input.required<GlobeScene>();
  readonly callouts = input<readonly GlobeCallout[]>([]);
  readonly description = input('');
  readonly zoom = input(1);
  readonly autoRotate = input(true);
  /** Changing this value recentres the view (the locate control). */
  readonly recenter = input(0);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private renderer: GlobeRenderer | null = null;
  private requestRender: () => void = () => undefined;
  private rotation = START_LONGITUDE;

  constructor() {
    const destroyRef = inject(DestroyRef);

    effect(() => {
      const scene = this.scene();
      this.renderer?.setScene(scene, performance.now());
      this.requestRender();
    });
    effect(() => {
      this.zoom();
      this.autoRotate();
      this.requestRender();
    });
    effect(() => {
      if (this.recenter() > 0) this.rotation = START_LONGITUDE;
      this.requestRender();
    });

    afterNextRender(() => {
      // No layout engine (for example a unit-test DOM): nothing to draw.
      if (typeof matchMedia !== 'function' || typeof ResizeObserver !== 'function') return;
      const host = this.host.nativeElement;
      const canvas = this.canvas().nativeElement;
      const context = canvas.getContext('2d');
      if (!context) return;

      this.renderer = new GlobeRenderer(context, landDots(DOT_LATTICE_SIZE));
      this.renderer.setScene(this.scene(), Number.NEGATIVE_INFINITY);

      const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
      let width = 0;
      let height = 0;
      let frame = 0;
      let onScreen = true;
      let lastFrame = performance.now();
      let dragOffset = 0;
      let tiltOffset = 0;
      let hoverTilt = 0;
      let dragging: { x: number; y: number } | null = null;

      const draw = (now: number) => {
        if (!this.renderer || width === 0) return;
        const still = reducedMotion.matches;
        const delta = Math.min(64, now - lastFrame);
        lastFrame = now;
        if (!still && this.autoRotate() && !dragging) this.rotation += (delta / ROTATION_PERIOD_MS) * 360;
        if (!dragging) {
          dragOffset *= 1 - RELAX;
          tiltOffset *= 1 - RELAX;
        }
        const tilt = TILT_DEGREES + tiltOffset + hoverTilt;
        const positions = this.renderer.render(
          { centerLongitude: this.rotation + dragOffset, centerLatitude: Math.max(-60, Math.min(60, tilt)), zoom: this.zoom() },
          width,
          height,
          still ? 0 : now,
        );
        this.placeCallouts(positions);
      };

      const loop = (now: number) => {
        frame = 0;
        draw(now);
        const settling = Math.abs(dragOffset) > 0.05 || Math.abs(tiltOffset) > 0.05;
        if ((!reducedMotion.matches || settling || dragging) && onScreen && !document.hidden) frame = requestAnimationFrame(loop);
      };
      this.requestRender = () => {
        if (frame === 0) frame = requestAnimationFrame(loop);
      };

      const onPointerDown = (event: PointerEvent) => {
        dragging = { x: event.clientX, y: event.clientY };
        canvas.setPointerCapture(event.pointerId);
        this.requestRender();
      };
      const onPointerMove = (event: PointerEvent) => {
        if (dragging) {
          dragOffset -= (event.clientX - dragging.x) * 0.3;
          tiltOffset += (event.clientY - dragging.y) * 0.2;
          dragging = { x: event.clientX, y: event.clientY };
        } else {
          const bounds = canvas.getBoundingClientRect();
          hoverTilt = ((event.clientY - bounds.top) / bounds.height - 0.5) * 6;
        }
        this.requestRender();
      };
      const onPointerEnd = () => {
        dragging = null;
        hoverTilt = 0;
        this.requestRender();
      };
      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerup', onPointerEnd);
      canvas.addEventListener('pointerleave', onPointerEnd);

      const resize = new ResizeObserver(([entry]) => {
        if (!entry) return;
        const ratio = Math.min(2, devicePixelRatio || 1);
        width = entry.contentRect.width;
        height = entry.contentRect.height;
        host.toggleAttribute('data-compact', width < COMPACT_WIDTH_PX);
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        this.requestRender();
      });
      resize.observe(host);

      const visibility = new IntersectionObserver(([entry]) => {
        onScreen = entry?.isIntersecting ?? true;
        lastFrame = performance.now();
        this.requestRender();
      });
      visibility.observe(host);

      const onVisibilityChange = () => {
        lastFrame = performance.now();
        this.requestRender();
      };
      document.addEventListener('visibilitychange', onVisibilityChange);
      reducedMotion.addEventListener('change', onVisibilityChange);

      destroyRef.onDestroy(() => {
        cancelAnimationFrame(frame);
        resize.disconnect();
        visibility.disconnect();
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerup', onPointerEnd);
        canvas.removeEventListener('pointerleave', onPointerEnd);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        reducedMotion.removeEventListener('change', onVisibilityChange);
        this.renderer = null;
      });
    });
  }

  /**
   * Callouts follow their markers by direct style writes: 60 moves a second must not go through change detection.
   * Each takes the first of four positions around its marker that stays inside the globe and clears the others.
   */
  private placeCallouts(positions: ReadonlyMap<string, { x: number; y: number; visible: boolean }>): void {
    const host = this.host.nativeElement;
    const bounds = { width: host.clientWidth, height: host.clientHeight };
    const placed: { left: number; top: number; right: number; bottom: number }[] = [];
    const elements = Array.from(host.querySelectorAll<HTMLElement>('.callout'))
      .map((element) => ({ element, position: positions.get(element.dataset['id'] ?? '') }))
      .filter((entry): entry is { element: HTMLElement; position: { x: number; y: number; visible: boolean } } => !!entry.position)
      .sort((left, right) => left.position.y - right.position.y);

    for (const { element, position } of elements) {
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      const candidates = [
        { left: position.x + CALLOUT_GAP, top: position.y - height - CALLOUT_GAP },
        { left: position.x - width - CALLOUT_GAP, top: position.y - height - CALLOUT_GAP },
        { left: position.x + CALLOUT_GAP, top: position.y + CALLOUT_GAP },
        { left: position.x - width - CALLOUT_GAP, top: position.y + CALLOUT_GAP },
      ].map((corner) => ({ ...corner, right: corner.left + width, bottom: corner.top + height }));
      const inside = (box: (typeof candidates)[number]) =>
        box.left >= 0 && box.top >= 0 && box.right <= bounds.width && box.bottom <= bounds.height;
      const clear = (box: (typeof candidates)[number]) =>
        placed.every((other) => box.right <= other.left || box.left >= other.right || box.bottom <= other.top || box.top >= other.bottom);
      const chosen = candidates.find((box) => inside(box) && clear(box)) ?? candidates.find(inside) ?? candidates[0];
      if (!chosen) continue;
      if (position.visible) placed.push(chosen);
      element.style.transform = `translate(${chosen.left.toFixed(1)}px, ${chosen.top.toFixed(1)}px)`;
      element.style.opacity = position.visible ? '1' : '0';
    }
  }
}
