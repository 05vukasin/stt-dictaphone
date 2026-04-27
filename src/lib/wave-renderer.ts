/**
 * Pure canvas renderers for the hybrid wave visualization.
 *
 * Two modes:
 *   - idle: 3 stacked sine layers driven only by elapsed time
 *   - reactive: amplitudes derived from an AnalyserNode frequency buffer
 *
 * Both render functions are deterministic given their inputs and do not touch
 * window/document, so they can be unit-tested with jsdom.
 */

export interface WaveStyle {
  color: string; // CSS color (e.g. "#1c1c1c")
  amplitude: number; // px max deflection from centerline
  frequency: number; // wave count across the canvas width
  phase: number; // current phase in radians
  alpha: number; // 0..1
  lineWidth: number;
}

export interface RenderOpts {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  styles: WaveStyle[];
  /** Optional reactive amplitude array (0..1 per bin). */
  reactive?: number[];
  /** Crossfade between idle (0) and reactive (1) — values in between blend. */
  reactiveBlend: number;
}

export function clear(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.clearRect(0, 0, width, height);
}

/**
 * Draws all wave layers in one pass.
 * Path is sampled at 1px steps along the X axis.
 */
export function drawWaves(opts: RenderOpts) {
  const { ctx, width, height, styles, reactive, reactiveBlend } = opts;
  const cy = height / 2;
  const blend = clamp01(reactiveBlend);
  for (const style of styles) {
    ctx.save();
    ctx.globalAlpha = style.alpha;
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.lineWidth;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let x = 0; x <= width; x++) {
      const t = x / width;
      const sineY = Math.sin(t * Math.PI * 2 * style.frequency + style.phase);
      let amp = sineY * style.amplitude;
      if (reactive && reactive.length > 0 && blend > 0) {
        const i = Math.floor(t * reactive.length);
        const reactiveAmp = (reactive[i] - 0.5) * 2 * style.amplitude * 1.6;
        amp = lerp(amp, reactiveAmp, blend);
      }
      const y = cy + amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }
}

export function defaultStyles(color: string): WaveStyle[] {
  return [
    { color, amplitude: 36, frequency: 1.1, phase: 0, alpha: 0.32, lineWidth: 2 },
    { color, amplitude: 26, frequency: 1.7, phase: Math.PI / 3, alpha: 0.22, lineWidth: 1.5 },
    { color, amplitude: 18, frequency: 2.3, phase: Math.PI / 5, alpha: 0.14, lineWidth: 1.2 },
  ];
}

/**
 * Advances the phase of each style by a fixed delta scaled per layer.
 * Returns a new array (does not mutate input).
 */
export function advancePhases(styles: WaveStyle[], deltaMs: number): WaveStyle[] {
  const speeds = [0.0011, 0.0017, 0.0023];
  return styles.map((s, i) => ({
    ...s,
    phase: (s.phase + deltaMs * (speeds[i % speeds.length] ?? 0.0015)) % (Math.PI * 2),
  }));
}

/**
 * Derives a smoothed reactive amplitude array from raw frequency data.
 * Returns one value per output bin in 0..1.
 */
export function smoothReactive(
  freq: Uint8Array,
  bins: number,
  prev: number[] | null,
  smoothing = 0.45,
): number[] {
  const result = new Array<number>(bins);
  const step = freq.length / bins;
  for (let i = 0; i < bins; i++) {
    let sum = 0;
    let count = 0;
    const start = Math.floor(i * step);
    const end = Math.floor((i + 1) * step);
    for (let j = start; j < end; j++) {
      sum += freq[j] / 255;
      count++;
    }
    const avg = count > 0 ? sum / count : 0;
    const target = clamp01(avg);
    result[i] = prev && prev[i] != null ? lerp(prev[i], target, smoothing) : target;
  }
  return result;
}

export function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
