import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ThemePreferences } from '../../../../core/theme/theme-preferences';
import { MinorUnitsCurrencyPipe } from '../../../../shared/pipes/minor-units-currency/minor-units-currency-pipe';
import { readHexToken, readNumberToken } from '../../../../shared/ui/canvas/css-color-token';
import { Icon } from '../../../../shared/ui/icon/icon';
import type { GlobeCallout } from '../../models/operations-overview';
import { DARK_GLOBE_PALETTE, type GlobeHitTarget, type GlobePalette, type GlobeScene, type GlobeTarget } from './globe-renderer';
import { SingaporeMapRenderer } from './singapore-map-renderer';

/** Heading of the starting view: north up. */
const START_LONGITUDE = 0;
const TILT_DEGREES = 18;
/** Below this map width only the held-transfer callout is shown, so callouts never collide. */
const COMPACT_WIDTH_PX = 480;
/** Space between a marker and its callout. */
const CALLOUT_GAP = 14;
/** Degrees per pixel dragged: longitude across, tilt down. */
const DRAG_LONGITUDE_PER_PX = 0.3;
const DRAG_TILT_PER_PX = 0.2;
/** Degrees per arrow-key press. */
const KEY_LONGITUDE_STEP = 10;
const KEY_TILT_STEP = 5;
const MAX_TILT = 60;
/** Movement beyond this is a drag, never a click: a drag must not select or navigate. */
const DRAG_THRESHOLD_PX = 5;
/** Zoom per wheel pixel; a pinch zooms by the ratio of finger distances. */
const WHEEL_ZOOM_PER_PX = 0.0015;
const CAMERA_RESET_MS = 720;
/** Degrees of turn per pixel of a Shift- or right-button drag, and per Q / E press. */
const DRAG_HEADING_PER_PX = 0.35;
const KEY_HEADING_STEP = 10;

interface DustParticle {
  readonly x: number;
  readonly y: number;
  readonly driftX: number;
  readonly driftY: number;
  readonly depth: number;
  readonly size: number;
  readonly opacity: number;
  readonly phase: number;
  readonly tone: 'blue' | 'cyan' | 'violet';
}

/** Card-space dust: deliberately independent of the map projection and zoom. */
class DustParticleRenderer {
  private palette = DARK_GLOBE_PALETTE;
  /** Few, soft and moving: drift of a few pixels a second, deeper particles faster (parallax), low opacity. */
  private readonly particles: readonly DustParticle[] = Array.from({ length: 56 }, (_, index) => ({
    x: (index * 0.6180339887) % 1,
    y: (index * 0.7548776662 + 0.17) % 1,
    driftX: ((((index * 17) % 11) - 5) * 1.1 || 2.2) * (0.6 + ((index * 13) % 10) / 14),
    driftY: (((index * 23) % 9) - 4) * 0.7,
    depth: 0.25 + ((index * 13) % 10) / 14,
    size: 0.6 + ((index * 7) % 8) / 7,
    opacity: 0.18 + ((index * 11) % 7) / 28,
    phase: index * 0.83,
    tone: index % 19 === 0 ? 'violet' : index % 3 === 0 ? 'cyan' : 'blue',
  }));

  setPalette(palette: GlobePalette): void {
    this.palette = palette;
  }

  render(context: CanvasRenderingContext2D, width: number, height: number, timeMs: number, visible: boolean): void {
    context.clearRect(0, 0, width, height);
    if (!visible) return;

    const seconds = timeMs / 1000;
    for (const particle of this.particles) {
      const x =
        ((particle.x * width + particle.driftX * seconds + Math.sin(seconds / 18 + particle.phase) * particle.depth * 12) %
          width +
          width) %
        width;
      const y =
        ((particle.y * height + particle.driftY * seconds + Math.cos(seconds / 21 + particle.phase) * particle.depth * 8) %
          height +
          height) %
        height;
      const shimmer = 0.82 + 0.18 * Math.sin(seconds / 5 + particle.phase);
      const color = particle.tone === 'violet' ? this.palette.violet : particle.tone === 'cyan' ? this.palette.node : this.palette.particle;
      context.globalAlpha = particle.opacity * shimmer;
      context.fillStyle = color;
      context.shadowColor = color;
      context.shadowBlur = particle.size > 1.3 ? 8 : 3;
      context.beginPath();
      context.arc(x, y, particle.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    context.shadowBlur = 0;
  }
}

const clampTilt = (tilt: number): number => Math.max(-MAX_TILT, Math.min(MAX_TILT, tilt));

/**
 * The orientation the analyst leaves the globe at. A drag or an arrow key moves it, and it stays exactly there:
 * nothing relaxes it back. Auto-rotation only ever adds to the longitude it finds, so resuming continues from
 * wherever the globe was left. Only the locate control returns it to the starting view.
 */
export class GlobeOrientation {
  longitude = START_LONGITUDE;
  tilt = TILT_DEGREES;

  drag(deltaX: number, deltaY: number): void {
    this.longitude -= deltaX * DRAG_LONGITUDE_PER_PX;
    this.tilt = clampTilt(this.tilt + deltaY * DRAG_TILT_PER_PX);
  }

  /** Arrow keys; returns false for any other key, so the page keeps it. */
  step(key: string): boolean {
    const steps: Readonly<Record<string, readonly [number, number]>> = {
      ArrowLeft: [KEY_LONGITUDE_STEP, 0],
      ArrowRight: [-KEY_LONGITUDE_STEP, 0],
      ArrowUp: [0, KEY_TILT_STEP],
      ArrowDown: [0, -KEY_TILT_STEP],
    };
    const delta = steps[key];
    if (!delta) return false;
    this.longitude += delta[0];
    this.tilt = clampTilt(this.tilt + delta[1]);
    return true;
  }

  reset(): void {
    this.longitude = START_LONGITUDE;
    this.tilt = TILT_DEGREES;
  }
}

/** The globe's colours from the active theme's tokens (design-system/themes), falling back to the dark globe. */
function paletteFrom(element: Element): GlobePalette {
  const hex = (token: string, fallback: string) => readHexToken(element, token, fallback);
  const dark = DARK_GLOBE_PALETTE;
  return {
    tones: {
      normal: hex('--sentinel-color-success', dark.tones.normal),
      elevated: hex('--sentinel-color-warning', dark.tones.elevated),
      high: hex('--sentinel-color-critical-soft', dark.tones.high),
      held: hex('--sentinel-color-critical', dark.tones.held),
      accent: hex('--sentinel-color-info', dark.tones.accent),
    },
    halo: hex('--sentinel-globe-halo', dark.halo),
    ocean: [hex('--sentinel-globe-ocean-1', dark.ocean[0]), hex('--sentinel-globe-ocean-2', dark.ocean[1]), hex('--sentinel-globe-ocean-3', dark.ocean[2])],
    rim: hex('--sentinel-globe-rim', dark.rim),
    rimStroke: hex('--sentinel-globe-rim-stroke', dark.rimStroke),
    land: hex('--sentinel-globe-land', dark.land),
    landLit: hex('--sentinel-globe-land-lit', dark.landLit),
    landBright: hex('--sentinel-globe-land-bright', dark.landBright),
    landHot: hex('--sentinel-globe-land-hot', dark.landHot),
    particle: hex('--sentinel-globe-particle', dark.particle),
    node: hex('--sentinel-globe-node', dark.node),
    markerCore: hex('--sentinel-globe-marker-core', dark.markerCore),
    glowStrength: readNumberToken(element, '--sentinel-globe-glow-strength', dark.glowStrength),
    violet: hex('--sentinel-color-accent-tertiary', dark.violet),
    selection: hex('--sentinel-color-text', dark.selection),
  };
}

/**
 * The live global network: the renderer draws, this component owns time, pointer, zoom and the HTML callouts.
 * One draw per animation frame, paused off-screen or hidden, and a single still frame under reduced motion.
 */
@Component({
  selector: 'sentinel-operations-globe',
  imports: [Icon, MinorUnitsCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    tabindex: '0',
    role: 'group',
    'aria-roledescription': 'map',
    'aria-label':
      'Live Singapore network map. Drag or use the arrow keys to pan; Shift-drag, right-drag, twist or Q and E to rotate; the wheel, pinch or plus and minus to zoom. Click a bank, account or transfer, or press N to step through them and Escape to clear.',
    '(keydown)': 'onKey($event)',
  },
  template: `
    <canvas #dustCanvas class="dust" aria-hidden="true"></canvas>
    <canvas #canvas aria-hidden="true"></canvas>
    <div class="callouts">
      @for (callout of callouts(); track callout.id) {
        <button
          type="button"
          class="callout"
          [attr.data-id]="callout.id"
          [attr.data-tone]="callout.tone"
          [attr.aria-label]="(callout.tone === 'held' ? 'Open the alert for the held transfer into ' : '') + callout.institution + ': ' + callout.label"
          (click)="chooseCallout(callout)"
        >
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
        </button>
      }
    </div>
    @if (tooltip(); as tip) {
      <span class="tooltip" role="status" [style.transform]="'translate(' + tip.x + 'px, ' + tip.y + 'px)'">{{ tip.label }}</span>
    }
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
  /** The selected target; the parent owns it and shows its detail panel. */
  readonly selection = input<GlobeTarget | null>(null);
  /** The analyst took the map by hand (drag or arrow key). */
  readonly explored = output<void>();
  /** A held-transfer callout was chosen: the parent opens that account's alert. */
  readonly openAlert = output<string>();
  /** A click, a tap or a key chose a target; null when the click landed on empty space. */
  readonly selected = output<GlobeTarget | null>();
  /** Wheel, pinch or key zoom, as a delta the parent clamps to its range. */
  readonly zoomBy = output<number>();
  /** Map heading in degrees; the parent owns it, like zoom, so its controls and the reset can set it. */
  readonly heading = input(0);
  /** Shift-drag, right-drag, a two-finger twist or Q / E turn the map: a delta in degrees. */
  readonly rotateBy = output<number>();
  readonly showParticles = input(true);
  readonly showRoutes = input(true);
  readonly showEntityLabels = input(false);

  /** The label under the pointer or of the keyboard-focused target, at its screen position. */
  protected readonly tooltip = signal<{ readonly label: string; readonly x: number; readonly y: number } | null>(null);
  private keyboardIndex = -1;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly dustCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('dustCanvas');
  private renderer: SingaporeMapRenderer | null = null;
  private dustRenderer: DustParticleRenderer | null = null;
  private requestRender: () => void = () => undefined;
  private cancelCameraTransition: () => void = () => undefined;
  private readonly orientation = new GlobeOrientation();
  private readonly theme = inject(ThemePreferences);
  private pendingReset = false;
  /** Animation time: advances only while animation runs, so pause freezes routes and pulses where they are. */
  private clock = 0;
  private previousRecenter = 0;

  constructor() {
    const destroyRef = inject(DestroyRef);

    // A theme change repaints the globe from the new tokens; it never touches the scene or its data.
    effect(() => {
      this.theme.brand();
      this.theme.appearance();
      const palette = paletteFrom(this.host.nativeElement);
      this.renderer?.setPalette(palette);
      this.dustRenderer?.setPalette(palette);
      this.requestRender();
    });

    effect(() => {
      this.renderer?.setSelection(this.selection());
      this.requestRender();
    });

    effect(() => {
      this.renderer?.setDisplayOptions({ showRoutes: this.showRoutes(), showEntityLabels: this.showEntityLabels() });
      this.showParticles();
      this.requestRender();
    });

    effect(() => {
      const scene = this.scene();
      this.renderer?.setScene(scene, this.clock);
      this.requestRender();
    });
    effect(() => {
      this.zoom();
      this.heading();
      this.autoRotate();
      this.requestRender();
    });
    effect(() => {
      const recenter = this.recenter();
      if (recenter !== this.previousRecenter) {
        this.previousRecenter = recenter;
        this.pendingReset = true;
      }
      this.requestRender();
    });

    afterNextRender(() => {
      // No layout engine (for example a unit-test DOM): nothing to draw.
      if (typeof matchMedia !== 'function' || typeof ResizeObserver !== 'function') return;
      const host = this.host.nativeElement;
      const canvas = this.canvas().nativeElement;
      const dustCanvas = this.dustCanvas().nativeElement;
      const context = canvas.getContext('2d');
      const dustContext = dustCanvas.getContext('2d');
      if (!context || !dustContext) return;

      this.renderer = new SingaporeMapRenderer(context, () => this.requestRender());
      this.dustRenderer = new DustParticleRenderer();
      this.renderer.setPalette(paletteFrom(host));
      this.dustRenderer.setPalette(paletteFrom(host));
      this.renderer.setScene(this.scene(), Number.NEGATIVE_INFINITY);
      this.renderer.setSelection(this.selection());
      this.renderer.setDisplayOptions({ showRoutes: this.showRoutes(), showEntityLabels: this.showEntityLabels() });

      const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
      let width = 0;
      let height = 0;
      let frame = 0;
      let onScreen = true;
      let lastFrame = performance.now();
      let displayedZoom = this.zoom();
      let displayedHeading = this.heading();
      let displayedLongitude = this.orientation.longitude;
      let displayedTilt = this.orientation.tilt;
      let cameraTransition: {
        readonly startedAt: number;
        readonly longitude: number;
        readonly tilt: number;
        readonly zoom: number;
        readonly heading: number;
      } | null = null;
      this.cancelCameraTransition = () => {
        if (!cameraTransition) return;
        this.orientation.longitude = displayedLongitude;
        this.orientation.tilt = displayedTilt;
        this.zoomBy.emit(displayedZoom - this.zoom());
        this.rotateBy.emit(displayedHeading - this.heading());
        cameraTransition = null;
        this.requestRender();
      };
      /** A drag pans; with Shift or the right button it turns the map instead. */
      let dragging: { pointerId: number; x: number; y: number; rotate: boolean } | null = null;
      /** Every pointer currently down, for pinch zoom; the first one drags. */
      const pointers = new Map<number, { x: number; y: number }>();
      let press: { pointerId: number; x: number; y: number; moved: boolean; rotate: boolean } | null = null;
      let pinchDistance = 0;
      let pinchAngle: number | null = null;

      const draw = (now: number) => {
        if (!this.renderer || width === 0) return;
        const still = reducedMotion.matches;
        const delta = Math.min(64, now - lastFrame);
        lastFrame = now;
        if (this.pendingReset) {
          this.pendingReset = false;
          if (still) {
            this.orientation.reset();
            displayedZoom = this.zoom();
            displayedHeading = this.heading();
            cameraTransition = null;
          } else {
            cameraTransition = {
              startedAt: now,
              longitude: this.orientation.longitude,
              tilt: this.orientation.tilt,
              zoom: displayedZoom,
              heading: displayedHeading,
            };
          }
        }
        // The map never turns by itself: "pause" freezes the flowing routes, pulses and dust instead.
        if (!still && this.autoRotate()) this.clock += delta;
        let longitude = this.orientation.longitude;
        let tilt = this.orientation.tilt;
        if (cameraTransition) {
          const progress = Math.min(1, (now - cameraTransition.startedAt) / CAMERA_RESET_MS);
          const eased = 1 - (1 - progress) ** 3;
          const longitudeDelta = (((START_LONGITUDE - cameraTransition.longitude + 540) % 360) + 360) % 360 - 180;
          longitude = cameraTransition.longitude + longitudeDelta * eased;
          tilt = cameraTransition.tilt + (TILT_DEGREES - cameraTransition.tilt) * eased;
          displayedZoom = cameraTransition.zoom + (this.zoom() - cameraTransition.zoom) * eased;
          displayedHeading = cameraTransition.heading + (this.heading() - cameraTransition.heading) * eased;
          if (progress >= 1) {
            this.orientation.reset();
            displayedZoom = this.zoom();
            displayedHeading = this.heading();
            cameraTransition = null;
          }
        } else {
          displayedZoom = this.zoom();
          displayedHeading = this.heading();
        }
        displayedLongitude = longitude;
        displayedTilt = tilt;
        this.dustRenderer?.render(dustContext, width, height, still ? 0 : this.clock, this.showParticles());
        const positions = this.renderer.render(
          { centerLongitude: longitude, centerLatitude: tilt, zoom: displayedZoom, heading: displayedHeading },
          width,
          height,
          still ? 0 : this.clock,
        );
        this.placeCallouts(positions);
        this.followTooltip();
      };

      // Markers and routes animate on every frame even while rotation is paused; reduced motion draws on demand.
      const loop = (now: number) => {
        frame = 0;
        draw(now);
        if ((!reducedMotion.matches || dragging || cameraTransition) && onScreen && !document.hidden) frame = requestAnimationFrame(loop);
      };
      this.requestRender = () => {
        if (frame === 0 && onScreen && !document.hidden) frame = requestAnimationFrame(loop);
      };

      const local = (event: PointerEvent | WheelEvent) => {
        const bounds = canvas.getBoundingClientRect();
        return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
      };
      const spread = () => {
        const [a, b] = [...pointers.values()];
        return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
      };
      const twist = () => {
        const [a, b] = [...pointers.values()];
        return a && b ? Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI) : null;
      };

      const onPointerDown = (event: PointerEvent) => {
        // Primary or right button (right turns the map), finger or pen.
        if (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 2) return;
        event.preventDefault(); // no text selection or image drag while exploring
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        canvas.setPointerCapture(event.pointerId);
        if (pointers.size === 2) {
          // A second finger turns the gesture into a pinch: no drag, no click.
          this.cancelCameraTransition();
          pinchDistance = spread();
          pinchAngle = twist();
          dragging = null;
          press = null;
          return;
        }
        press = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false, rotate: event.shiftKey || event.button === 2 };
        this.requestRender();
      };
      const onPointerMove = (event: PointerEvent) => {
        if (pointers.has(event.pointerId)) pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.size >= 2) {
          const distance = spread();
          if (pinchDistance > 0 && distance > 0) this.zoomBy.emit((distance / pinchDistance - 1) * this.zoom());
          pinchDistance = distance;
          // Two fingers turning rotate the map with them.
          const angle = twist();
          if (pinchAngle !== null && angle !== null) this.rotateBy.emit(((angle - pinchAngle + 540) % 360) - 180);
          pinchAngle = angle;
          return;
        }
        if (press && event.pointerId === press.pointerId && !press.moved) {
          if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < DRAG_THRESHOLD_PX) return;
          // Now it is a drag: rotation pauses, the hover tooltip goes, and the release will not click.
          this.cancelCameraTransition();
          press.moved = true;
          dragging = { pointerId: press.pointerId, x: press.x, y: press.y, rotate: press.rotate };
          host.setAttribute('data-dragging', '');
          this.hover(null);
          this.explored.emit();
        }
        if (dragging && event.pointerId === dragging.pointerId) {
          if (dragging.rotate) this.rotateBy.emit((event.clientX - dragging.x - (event.clientY - dragging.y)) * DRAG_HEADING_PER_PX);
          else this.orientation.drag(event.clientX - dragging.x, event.clientY - dragging.y);
          dragging = { pointerId: dragging.pointerId, x: event.clientX, y: event.clientY, rotate: dragging.rotate };
          this.requestRender();
          return;
        }
        if (event.pointerType === 'mouse' && pointers.size === 0) this.hover(this.renderer?.hitTest(local(event).x, local(event).y) ?? null);
      };
      // Release, cancel (the browser took the gesture, e.g. a vertical page scroll on touch) or lost capture all end
      // the gesture where it is: nothing is undone, so the globe stays exactly where it was left.
      const onPointerEnd = (event: PointerEvent) => {
        const wasPress = press && !press.rotate && event.pointerId === press.pointerId && !press.moved && event.type === 'pointerup';
        pointers.delete(event.pointerId);
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        if (pointers.size < 2) {
          pinchDistance = 0;
          pinchAngle = null;
        }
        if (wasPress) {
          // A press that never became a drag is a click: the target under it, or nothing.
          const point = local(event);
          const hit = this.renderer?.hitTest(point.x, point.y) ?? null;
          this.selected.emit(hit ? { kind: hit.kind, id: hit.id } : null);
        }
        if (press?.pointerId === event.pointerId) press = null;
        if (dragging?.pointerId === event.pointerId) {
          dragging = null;
          host.removeAttribute('data-dragging');
        }
        this.requestRender();
      };
      const onWheel = (event: WheelEvent) => {
        // The wheel zooms the globe instead of scrolling; a trackpad pinch arrives as a ctrl+wheel and does too.
        event.preventDefault();
        this.cancelCameraTransition();
        this.zoomBy.emit(-event.deltaY * WHEEL_ZOOM_PER_PX * (event.ctrlKey ? 4 : 1) * this.zoom());
      };
      const onLeave = () => this.hover(null);
      // The right button turns the map, so the context menu stays closed over it.
      const onContextMenu = (event: MouseEvent) => event.preventDefault();
      canvas.addEventListener('contextmenu', onContextMenu);
      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerup', onPointerEnd);
      canvas.addEventListener('pointercancel', onPointerEnd);
      canvas.addEventListener('lostpointercapture', onPointerEnd);
      canvas.addEventListener('pointerleave', onLeave);
      canvas.addEventListener('wheel', onWheel, { passive: false });

      const resize = new ResizeObserver(([entry]) => {
        if (!entry) return;
        const ratio = Math.min(2, devicePixelRatio || 1);
        width = entry.contentRect.width;
        height = entry.contentRect.height;
        host.toggleAttribute('data-compact', width < COMPACT_WIDTH_PX);
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        dustCanvas.width = Math.round(width * ratio);
        dustCanvas.height = Math.round(height * ratio);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        dustContext.setTransform(ratio, 0, 0, ratio, 0, 0);
        this.requestRender();
      });
      resize.observe(host);

      const visibility = new IntersectionObserver(([entry]) => {
        onScreen = entry?.isIntersecting ?? true;
        lastFrame = performance.now();
        if (onScreen) this.requestRender();
        else {
          cancelAnimationFrame(frame);
          frame = 0;
        }
      });
      visibility.observe(host);

      const onVisibilityChange = () => {
        lastFrame = performance.now();
        if (reducedMotion.matches && cameraTransition) {
          this.orientation.reset();
          displayedZoom = this.zoom();
          displayedHeading = this.heading();
          displayedLongitude = this.orientation.longitude;
          displayedTilt = this.orientation.tilt;
          cameraTransition = null;
        }
        if (!document.hidden) this.requestRender();
        else {
          cancelAnimationFrame(frame);
          frame = 0;
        }
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
        canvas.removeEventListener('pointercancel', onPointerEnd);
        canvas.removeEventListener('lostpointercapture', onPointerEnd);
        canvas.removeEventListener('pointerleave', onLeave);
        canvas.removeEventListener('contextmenu', onContextMenu);
        canvas.removeEventListener('wheel', onWheel);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        reducedMotion.removeEventListener('change', onVisibilityChange);
        this.renderer?.dispose();
        this.renderer = null;
        this.dustRenderer = null;
        this.cancelCameraTransition = () => undefined;
      });
    });
  }

  /** A held-transfer callout opens its alert; any other callout selects its bank. */
  protected chooseCallout(callout: GlobeCallout): void {
    if (callout.tone === 'held' && callout.accountId) this.openAlert.emit(callout.accountId);
    else if (callout.transactionId) this.selected.emit({ kind: 'transaction', id: callout.transactionId });
    else this.selected.emit({ kind: 'bank', id: callout.id });
  }

  protected onKey(event: KeyboardEvent): void {
    if (event.key === '+' || event.key === '=' || event.key === '-') {
      event.preventDefault();
      this.zoomBy.emit(event.key === '-' ? -0.1 : 0.1);
      return;
    }
    if (event.key === 'q' || event.key === 'Q' || event.key === 'e' || event.key === 'E') {
      event.preventDefault();
      this.cancelCameraTransition();
      this.rotateBy.emit(event.key.toLowerCase() === 'q' ? -KEY_HEADING_STEP : KEY_HEADING_STEP);
      this.explored.emit();
      return;
    }
    if (event.key === 'n' || event.key === 'N') {
      // Steps through every target drawn on the visible side of the globe, and selects it.
      const targets = this.renderer?.hitTargets() ?? [];
      if (targets.length === 0) return;
      event.preventDefault();
      this.keyboardIndex = (this.keyboardIndex + (event.shiftKey ? targets.length - 1 : 1)) % targets.length;
      const target = targets[this.keyboardIndex];
      if (!target) return;
      this.explored.emit();
      this.hover(target);
      this.selected.emit({ kind: target.kind, id: target.id });
      return;
    }
    if (event.key === 'Escape' && this.selection()) {
      this.selected.emit(null);
      this.hover(null);
      return;
    }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    this.cancelCameraTransition();
    this.orientation.step(event.key);
    event.preventDefault(); // the arrow keys pan the map instead of scrolling the page
    this.explored.emit();
    this.requestRender();
  }

  /** The hovered target: pointer cursor, renderer highlight and a label beside it. */
  private hoverTarget: GlobeHitTarget | null = null;
  private hover(target: GlobeHitTarget | null): void {
    if (this.hoverTarget?.id === target?.id && this.hoverTarget?.kind === target?.kind) return;
    this.hoverTarget = target;
    this.renderer?.setHover(target ? { kind: target.kind, id: target.id } : null);
    this.host.nativeElement.toggleAttribute('data-hover-target', target !== null);
    this.followTooltip();
    this.requestRender();
  }

  /** The tooltip follows its target as the globe turns; it goes when the target turns to the far side. */
  private followTooltip(): void {
    const target = this.hoverTarget;
    if (!target) {
      if (this.tooltip()) this.tooltip.set(null);
      return;
    }
    const now = this.renderer?.hitTargets().find((candidate) => candidate.kind === target.kind && candidate.id === target.id);
    if (!now) {
      this.tooltip.set(null);
      return;
    }
    const x = Math.round(now.x + 14);
    const y = Math.round(now.y - 34);
    const current = this.tooltip();
    if (!current || current.x !== x || current.y !== y || current.label !== target.label) this.tooltip.set({ label: target.label, x, y });
  }

  /**
   * Callouts follow their markers by direct style writes: 60 moves a second must not go through change detection.
   * The held transfer is placed first, so it always gets the best spot; each other callout takes the first position
   * around its marker, nearest first, that stays inside the globe and clears those already placed, or is hidden.
   * A callout never covers another.
   */
  private placeCallouts(positions: ReadonlyMap<string, { x: number; y: number; visible: boolean }>): void {
    const host = this.host.nativeElement;
    const bounds = { width: host.clientWidth, height: host.clientHeight };
    // On a wide card the network figures sit over the map's left side and the bank selector over its top edge.
    const wide = bounds.width >= 900;
    const leftEdge = wide ? bounds.width * 0.27 : 0;
    const topEdge = wide ? 60 : 0;
    const rightEdge = wide ? bounds.width - 72 : bounds.width;
    const placed: { left: number; top: number; right: number; bottom: number }[] = [];
    const elements = Array.from(host.querySelectorAll<HTMLElement>('.callout'))
      .map((element) => ({ element, position: positions.get(element.dataset['id'] ?? '') }))
      .filter((entry): entry is { element: HTMLElement; position: { x: number; y: number; visible: boolean } } => !!entry.position)
      .sort((left, right) => {
        const held = Number(right.element.dataset['tone'] === 'held') - Number(left.element.dataset['tone'] === 'held');
        return held !== 0 ? held : left.position.y - right.position.y;
      });

    for (const { element, position } of elements) {
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      // Four corners around the marker first; then the same corners stepped one and two callouts away.
      const step = height + CALLOUT_GAP / 2;
      const candidates = [0, -1, 1, -2, 2]
        .flatMap((shift) => [
          { left: position.x + CALLOUT_GAP, top: position.y - height - CALLOUT_GAP + shift * step },
          { left: position.x - width - CALLOUT_GAP, top: position.y - height - CALLOUT_GAP + shift * step },
          { left: position.x + CALLOUT_GAP, top: position.y + CALLOUT_GAP + shift * step },
          { left: position.x - width - CALLOUT_GAP, top: position.y + CALLOUT_GAP + shift * step },
        ])
        .map((corner) => ({ ...corner, right: corner.left + width, bottom: corner.top + height }));
      const inside = (box: (typeof candidates)[number]) =>
        box.left >= leftEdge && box.top >= topEdge && box.right <= rightEdge && box.bottom <= bounds.height;
      const clear = (box: (typeof candidates)[number]) =>
        placed.every((other) => box.right <= other.left || box.left >= other.right || box.bottom <= other.top || box.top >= other.bottom);
      const clearSpot = candidates.find((box) => inside(box) && clear(box));
      const chosen = clearSpot ?? candidates.find(inside) ?? candidates[0];
      if (!chosen) continue;
      const shown = position.visible && clearSpot !== undefined;
      if (shown) placed.push(chosen);
      element.style.transform = `translate(${chosen.left.toFixed(1)}px, ${chosen.top.toFixed(1)}px)`;
      element.style.opacity = shown ? '1' : '0';
      // A hidden callout is neither clickable nor in the tab order.
      element.style.pointerEvents = shown ? 'auto' : 'none';
      element.tabIndex = shown ? 0 : -1;
    }
  }
}
