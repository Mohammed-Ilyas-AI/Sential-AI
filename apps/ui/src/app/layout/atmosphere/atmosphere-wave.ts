import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, effect, inject, viewChild } from '@angular/core';
import { ThemePreferences } from '../../core/theme/theme-preferences';
import { hexWithAlpha, readHexToken, readNumberToken } from '../../shared/ui/canvas/css-color-token';

const WAVES = 7;
const PARTICLES = 90;
/** One full drift of the wave field; slow enough to read as ambience, not motion. */
const DRIFT_PERIOD_MS = 26_000;

interface WavePalette {
  readonly start: string;
  readonly mid: string;
  readonly end: string;
  readonly spark: string;
  /** 1 on dark canvases (additive light); lower on light ones, which also draw normally rather than additively. */
  readonly strength: number;
}

function paletteFrom(element: Element): WavePalette {
  return {
    start: readHexToken(element, '--sentinel-wave-start', '#3678ff'),
    mid: readHexToken(element, '--sentinel-wave-mid', '#5e78ff'),
    end: readHexToken(element, '--sentinel-wave-end', '#a85cff'),
    spark: readHexToken(element, '--sentinel-wave-spark', '#aac3ff'),
    strength: readNumberToken(element, '--sentinel-wave-strength', 1),
  };
}

interface Particle {
  readonly wave: number;
  readonly offset: number;
  readonly speed: number;
  readonly size: number;
}

/**
 * The SENTINEL atmospheric particle wave: layered blue-to-violet curves with fine particles riding them.
 * Decorative, canvas 2D, paused off-screen and when hidden, and a still frame under reduced motion.
 */
@Component({
  selector: 'sentinel-atmosphere-wave',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `<canvas #canvas></canvas>`,
  styles: `
    :host {
      display: block;
      pointer-events: none;
    }
    canvas {
      width: 100%;
      height: 100%;
      display: block;
    }
  `,
})
export class AtmosphereWave {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly theme = inject(ThemePreferences);
  private palette: WavePalette | null = null;
  private redraw: () => void = () => undefined;

  constructor() {
    const destroyRef = inject(DestroyRef);
    effect(() => {
      this.theme.brand();
      this.theme.appearance();
      this.palette = null;
      this.redraw();
    });
    afterNextRender(() => {
      if (typeof matchMedia !== 'function' || typeof ResizeObserver !== 'function') return;
      const canvas = this.canvas().nativeElement;
      const context = canvas.getContext('2d');
      if (!context) return;

      const particles: Particle[] = Array.from({ length: PARTICLES }, (_, index) => ({
        wave: index % WAVES,
        offset: (index * 0.61803) % 1,
        speed: 0.012 + ((index * 37) % 11) / 900,
        size: 0.5 + ((index * 17) % 7) / 8,
      }));
      const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
      let width = 0;
      let height = 0;
      let frame = 0;
      let onScreen = true;
      const start = performance.now();

      const waveY = (wave: number, x: number, phase: number) => {
        const base = height * (0.42 + wave * 0.07);
        const amplitude = height * (0.16 - wave * 0.012);
        return base + Math.sin((x / width) * Math.PI * 1.6 + phase + wave * 0.45) * amplitude * (0.55 + (x / width) * 0.6);
      };

      const draw = (now: number) => {
        if (width === 0) return;
        const elapsed = reducedMotion.matches ? 0 : now - start;
        const phase = (elapsed / DRIFT_PERIOD_MS) * Math.PI * 2;
        const palette = (this.palette ??= paletteFrom(this.host.nativeElement));
        const { strength } = palette;
        context.clearRect(0, 0, width, height);
        context.globalCompositeOperation = strength >= 1 ? 'lighter' : 'source-over';
        for (let wave = 0; wave < WAVES; wave += 1) {
          const gradient = context.createLinearGradient(0, 0, width, 0);
          gradient.addColorStop(0, hexWithAlpha(palette.start, (0.1 + wave * 0.02) * strength));
          gradient.addColorStop(0.55, hexWithAlpha(palette.mid, (0.24 + wave * 0.035) * strength));
          gradient.addColorStop(1, hexWithAlpha(palette.end, (0.12 + wave * 0.025) * strength));
          context.strokeStyle = gradient;
          context.lineWidth = wave === 3 ? 1.8 : 1;
          context.shadowColor = hexWithAlpha(palette.mid, 0.8 * strength);
          context.shadowBlur = wave === 3 ? 10 : 4;
          context.beginPath();
          for (let x = 0; x <= width; x += 6) {
            const y = waveY(wave, x, phase * (1 + wave * 0.08));
            if (x === 0) context.moveTo(x, y);
            else context.lineTo(x, y);
          }
          context.stroke();
        }
        context.shadowBlur = 0;
        for (const particle of particles) {
          const t = (particle.offset + (elapsed / 1000) * particle.speed) % 1;
          const x = t * width;
          const y = waveY(particle.wave, x, phase * (1 + particle.wave * 0.08));
          const fade = Math.sin(t * Math.PI);
          context.fillStyle = hexWithAlpha(palette.spark, (0.35 + 0.6 * fade) * strength);
          context.fillRect(x, y, particle.size, particle.size);
        }
        context.globalCompositeOperation = 'source-over';
      };

      const loop = (now: number) => {
        frame = 0;
        draw(now);
        if (!reducedMotion.matches && onScreen && !document.hidden) frame = requestAnimationFrame(loop);
      };
      const requestDraw = () => {
        if (frame === 0) frame = requestAnimationFrame(loop);
      };
      this.redraw = requestDraw;

      const resize = new ResizeObserver(([entry]) => {
        if (!entry) return;
        const ratio = Math.min(2, devicePixelRatio || 1);
        width = entry.contentRect.width;
        height = entry.contentRect.height;
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        requestDraw();
      });
      resize.observe(this.host.nativeElement);
      const visibility = new IntersectionObserver(([entry]) => {
        onScreen = entry?.isIntersecting ?? true;
        requestDraw();
      });
      visibility.observe(this.host.nativeElement);
      document.addEventListener('visibilitychange', requestDraw);

      destroyRef.onDestroy(() => {
        cancelAnimationFrame(frame);
        resize.disconnect();
        visibility.disconnect();
        document.removeEventListener('visibilitychange', requestDraw);
      });
    });
  }
}
