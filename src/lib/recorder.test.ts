import { describe, it, expect, beforeEach, vi } from "vitest";
import { DictaphoneRecorder, pickMimeType } from "./recorder";

class MockMediaRecorder {
  static instances: MockMediaRecorder[] = [];
  static isTypeSupported = vi.fn((mime: string) =>
    ["audio/webm;codecs=opus", "audio/webm"].includes(mime),
  );

  state: "inactive" | "recording" | "paused" = "inactive";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;

  constructor(
    public stream: MediaStream,
    public options?: { mimeType?: string },
  ) {
    MockMediaRecorder.instances.push(this);
  }

  start() {
    this.state = "recording";
  }
  pause() {
    this.state = "paused";
  }
  resume() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    queueMicrotask(() => {
      this.ondataavailable?.({
        data: new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" }),
      });
      this.onstop?.();
    });
  }
}

beforeEach(() => {
  MockMediaRecorder.instances = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).MediaRecorder = MockMediaRecorder;

  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn(async () => {
        return {
          getTracks: () => [{ stop: vi.fn() }],
        } as unknown as MediaStream;
      }),
    },
  });
});

describe("pickMimeType", () => {
  it("returns a supported webm mime", () => {
    expect(pickMimeType("webm")).toBe("audio/webm;codecs=opus");
  });
});

describe("DictaphoneRecorder", () => {
  it("transitions idle → recording → idle on start/stop", async () => {
    const rec = new DictaphoneRecorder("webm");
    const states: string[] = [];
    rec.on("state", (s) => states.push(s));

    await rec.start();
    expect(rec.getState()).toBe("recording");

    const blobP = rec.stop();
    const blob = await blobP;

    expect(blob).toBeInstanceOf(Blob);
    expect(rec.getState()).toBe("idle");
    expect(states).toEqual(["recording", "stopping", "idle"]);
  });

  it("rejects starting from a non-idle state", async () => {
    const rec = new DictaphoneRecorder("webm");
    await rec.start();
    await expect(rec.start()).rejects.toThrow();
    await rec.stop();
  });

  it("pause then resume keeps state coherent", async () => {
    const rec = new DictaphoneRecorder("webm");
    await rec.start();
    rec.pause();
    expect(rec.getState()).toBe("paused");
    rec.resume();
    expect(rec.getState()).toBe("recording");
    await rec.stop();
    expect(rec.getState()).toBe("idle");
  });

  it("emits durationMs while recording", async () => {
    vi.useFakeTimers();
    const rec = new DictaphoneRecorder("webm");
    const samples: number[] = [];
    rec.on("durationMs", (ms) => samples.push(ms));
    await rec.start();
    vi.advanceTimersByTime(800);
    expect(samples.length).toBeGreaterThan(0);
    expect(samples[samples.length - 1]).toBeGreaterThanOrEqual(0);
    vi.useRealTimers();
    await rec.stop();
  });
});
