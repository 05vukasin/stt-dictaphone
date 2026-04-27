import { describe, it, expect } from "vitest";
import {
  advancePhases,
  clamp01,
  defaultStyles,
  drawWaves,
  lerp,
  smoothReactive,
} from "./wave-renderer";

describe("clamp01 / lerp", () => {
  it("clamp01 clamps to 0..1", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.4)).toBe(0.4);
  });
  it("lerp interpolates", () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.5)).toBe(5);
  });
});

describe("defaultStyles", () => {
  it("returns three layers with descending amplitudes", () => {
    const s = defaultStyles("#000");
    expect(s).toHaveLength(3);
    expect(s[0].amplitude).toBeGreaterThan(s[1].amplitude);
    expect(s[1].amplitude).toBeGreaterThan(s[2].amplitude);
  });
});

describe("advancePhases", () => {
  it("returns a new array, doesn't mutate", () => {
    const s = defaultStyles("#000");
    const next = advancePhases(s, 16);
    expect(next).not.toBe(s);
    expect(next[0].phase).not.toBe(s[0].phase);
    expect(s[0].phase).toBe(0);
  });

  it("keeps phase in 0..2pi", () => {
    const s = defaultStyles("#000");
    const next = advancePhases(s, 10_000_000);
    for (const layer of next) {
      expect(layer.phase).toBeGreaterThanOrEqual(0);
      expect(layer.phase).toBeLessThan(Math.PI * 2);
    }
  });
});

describe("smoothReactive", () => {
  const freq = new Uint8Array([255, 255, 255, 255, 0, 0, 0, 0]);

  it("returns the requested number of bins in 0..1", () => {
    const out = smoothReactive(freq, 4, null);
    expect(out).toHaveLength(4);
    expect(out[0]).toBeCloseTo(1, 5);
    expect(out[3]).toBeCloseTo(0, 5);
  });

  it("smooths toward the new value when prev is provided", () => {
    const prev = [0, 0, 0, 0];
    const out = smoothReactive(freq, 4, prev, 0.5);
    expect(out[0]).toBeCloseTo(0.5, 2);
  });
});

describe("drawWaves", () => {
  function fakeCtx() {
    const calls: string[] = [];
    const ctx = {
      save: () => calls.push("save"),
      restore: () => calls.push("restore"),
      beginPath: () => calls.push("beginPath"),
      moveTo: () => calls.push("moveTo"),
      lineTo: () => calls.push("lineTo"),
      stroke: () => calls.push("stroke"),
      clearRect: () => calls.push("clearRect"),
      // mutable state collected by setters
      globalAlpha: 1,
      strokeStyle: "",
      lineWidth: 0,
      lineCap: "" as CanvasLineCap,
    };
    return { ctx, calls };
  }

  it("issues a save/stroke/restore per layer", () => {
    const { ctx, calls } = fakeCtx();
    drawWaves({
      ctx: ctx as unknown as CanvasRenderingContext2D,
      width: 100,
      height: 50,
      styles: defaultStyles("#000"),
      reactiveBlend: 0,
    });
    const saves = calls.filter((c) => c === "save").length;
    const strokes = calls.filter((c) => c === "stroke").length;
    const restores = calls.filter((c) => c === "restore").length;
    expect(saves).toBe(3);
    expect(strokes).toBe(3);
    expect(restores).toBe(3);
  });

  it("uses reactive bins when blend > 0", () => {
    const { ctx, calls } = fakeCtx();
    drawWaves({
      ctx: ctx as unknown as CanvasRenderingContext2D,
      width: 50,
      height: 30,
      styles: defaultStyles("#000"),
      reactive: [1, 0, 1, 0, 1, 0, 1, 0],
      reactiveBlend: 1,
    });
    expect(calls.filter((c) => c === "lineTo").length).toBeGreaterThan(0);
  });
});
