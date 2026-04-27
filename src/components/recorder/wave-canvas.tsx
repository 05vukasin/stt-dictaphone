"use client";

import { useEffect, useRef } from "react";
import {
  advancePhases,
  clear,
  defaultStyles,
  drawWaves,
  smoothReactive,
  type WaveStyle,
} from "@/lib/wave-renderer";

interface WaveCanvasProps {
  /** Current MediaStream during recording, or null when idle. */
  stream: MediaStream | null;
  /** Are we recording right now? Drives the idle ↔ reactive crossfade. */
  isActive: boolean;
}

const REACTIVE_BINS = 96;
const FADE_MS = 600;

export function WaveCanvas({ stream, isActive }: WaveCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;
    const ctx: CanvasRenderingContext2D = ctx2d;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    let raf = 0;
    let lastTs = performance.now();
    let blend = 0; // 0 = idle, 1 = reactive
    let analyser: AnalyserNode | null = null;
    let cleanupAnalyser: (() => void) | null = null;
    let freqBuffer: Uint8Array | null = null;
    let prevReactive: number[] | null = null;

    const cssFg = () =>
      getComputedStyle(document.body).getPropertyValue("--fg").trim() || "#1c1c1c";

    let styles: WaveStyle[] = defaultStyles(cssFg());

    function resize() {
      const c = canvasRef.current;
      if (!c) return;
      const rect = c.getBoundingClientRect();
      c.width = Math.max(1, Math.floor(rect.width * dpr));
      c.height = Math.max(1, Math.floor(rect.height * dpr));
    }
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    function setupAnalyser(activeStream: MediaStream) {
      cleanupAnalyser?.();
      // Lazy import keeps module side-effects out of SSR.
      import("@/lib/audio-context").then(({ attachAnalyser }) => {
        const setup = attachAnalyser(activeStream, 1024);
        analyser = setup.analyser;
        freqBuffer = new Uint8Array(analyser.frequencyBinCount);
        cleanupAnalyser = setup.disconnect;
      });
    }

    if (stream && isActive) setupAnalyser(stream);

    function loop(ts: number) {
      const c = canvasRef.current;
      if (!c) return;
      const w = c.width;
      const h = c.height;
      const delta = ts - lastTs;
      lastTs = ts;

      // Crossfade
      const target = isActive ? 1 : 0;
      const dir = target - blend;
      if (dir !== 0) {
        const step = (delta / FADE_MS) * Math.sign(dir);
        blend += step;
        if ((dir > 0 && blend > 1) || (dir < 0 && blend < 0)) blend = target;
      }

      let reactive: number[] | undefined;
      if (analyser && freqBuffer) {
        // Cast to any to satisfy variant typings on older lib.dom — value semantics are identical.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        analyser.getByteFrequencyData(freqBuffer as any);
        prevReactive = smoothReactive(freqBuffer, REACTIVE_BINS, prevReactive, 0.45);
        reactive = prevReactive;
      }

      styles = advancePhases(styles, delta);

      ctx.save();
      ctx.scale(dpr, dpr);
      // Re-fetch CSS color each frame so a theme swap is picked up live.
      const color = cssFg();
      const styled = styles.map((s) => ({ ...s, color }));
      clear(ctx, w / dpr, h / dpr);
      drawWaves({
        ctx,
        width: w / dpr,
        height: h / dpr,
        styles: styled,
        reactive,
        reactiveBlend: blend,
      });
      ctx.restore();

      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      cleanupAnalyser?.();
    };
  }, [stream, isActive]);

  return <canvas ref={canvasRef} className="wave" aria-hidden="true" />;
}
