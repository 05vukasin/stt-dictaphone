"use client";

import type { AudioFormat } from "@/types/settings";

export type RecorderState = "idle" | "recording" | "paused" | "stopping";

export interface RecorderEvents {
  state: (s: RecorderState) => void;
  level: (peak: number) => void; // peak amplitude 0..1 over the slice
  durationMs: (ms: number) => void;
  error: (err: Error) => void;
}

const PREFERRED_MIME: Record<AudioFormat, string[]> = {
  webm: ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"],
  wav: ["audio/wav", "audio/x-wav"],
};

export function pickMimeType(format: AudioFormat): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  const candidates = PREFERRED_MIME[format] ?? PREFERRED_MIME.webm;
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  // Fallback: anything supported.
  for (const m of [...PREFERRED_MIME.webm, "audio/mp4", "audio/aac"]) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

export class DictaphoneRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private state: RecorderState = "idle";
  private startedAt = 0;
  private accumulatedMs = 0; // for pause/resume
  private resolveStop: ((blob: Blob) => void) | null = null;
  private mime = "";
  private rafHandle: number | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private listeners: Partial<{ [K in keyof RecorderEvents]: Set<RecorderEvents[K]> }> = {};

  constructor(
    private readonly format: AudioFormat = "webm",
    private readonly micDeviceId: string = "",
  ) {}

  on<K extends keyof RecorderEvents>(event: K, cb: RecorderEvents[K]) {
    if (!this.listeners[event]) this.listeners[event] = new Set() as never;
    (this.listeners[event] as Set<RecorderEvents[K]>).add(cb);
    return () => this.off(event, cb);
  }

  off<K extends keyof RecorderEvents>(event: K, cb: RecorderEvents[K]) {
    this.listeners[event]?.delete(cb as never);
  }

  private emit<K extends keyof RecorderEvents>(event: K, ...args: Parameters<RecorderEvents[K]>) {
    const set = this.listeners[event];
    if (!set) return;
    for (const cb of set as Set<(...a: unknown[]) => void>) {
      try {
        cb(...(args as unknown[]));
      } catch {
        // ignore listener errors
      }
    }
  }

  getState(): RecorderState {
    return this.state;
  }

  getMime(): string {
    return this.mime;
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  async start(): Promise<void> {
    if (this.state !== "idle") throw new Error(`Cannot start while in state ${this.state}`);
    const constraints: MediaStreamConstraints = {
      audio: this.micDeviceId
        ? { deviceId: { exact: this.micDeviceId }, echoCancellation: true, noiseSuppression: true }
        : { echoCancellation: true, noiseSuppression: true },
    };
    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.mime = pickMimeType(this.format);
    this.mediaRecorder = new MediaRecorder(this.stream, this.mime ? { mimeType: this.mime } : {});
    this.chunks = [];
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.onerror = (e) => {
      const ev = e as unknown as { error?: Error };
      this.emit("error", ev.error ?? new Error("MediaRecorder error"));
    };
    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: this.mime || "audio/webm" });
      this.chunks = [];
      this.cleanup();
      this.setState("idle");
      this.resolveStop?.(blob);
      this.resolveStop = null;
    };
    this.attachLevelMonitor();
    this.startedAt = Date.now();
    this.accumulatedMs = 0;
    this.mediaRecorder.start(1000);
    this.setState("recording");
    this.tickDuration();
  }

  pause(): void {
    if (this.state !== "recording" || !this.mediaRecorder) return;
    this.mediaRecorder.pause();
    this.accumulatedMs += Date.now() - this.startedAt;
    this.setState("paused");
  }

  resume(): void {
    if (this.state !== "paused" || !this.mediaRecorder) return;
    this.mediaRecorder.resume();
    this.startedAt = Date.now();
    this.setState("recording");
    this.tickDuration();
  }

  async stop(): Promise<Blob> {
    if (this.state === "idle") return new Blob([], { type: this.mime || "audio/webm" });
    if (this.state === "paused") this.resume(); // ensure flush
    this.setState("stopping");
    return new Promise<Blob>((resolve) => {
      this.resolveStop = resolve;
      this.mediaRecorder?.stop();
    });
  }

  cancel(): void {
    if (this.state === "idle") return;
    try {
      this.mediaRecorder?.stop();
    } catch {
      // ignore
    }
    this.cleanup();
    this.setState("idle");
  }

  private setState(s: RecorderState) {
    this.state = s;
    this.emit("state", s);
  }

  private tickDuration() {
    if (this.state !== "recording") return;
    const now = Date.now();
    this.emit("durationMs", this.accumulatedMs + (now - this.startedAt));
    setTimeout(() => this.tickDuration(), 250);
  }

  private attachLevelMonitor() {
    if (!this.stream) return;
    try {
      // Lazy import to avoid SSR crash.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { attachAnalyser } = require("./audio-context") as typeof import("./audio-context");
      const { analyser, disconnect } = attachAnalyser(this.stream, 512);
      this.analyser = analyser;
      this.dataArray = new Uint8Array(analyser.fftSize);
      const cleanup = () => disconnect();
      const off = this.on("state", (s) => {
        if (s === "idle") {
          cleanup();
          off();
        }
      });
      const loop = () => {
        if (!this.analyser || !this.dataArray) return;
        if (this.state === "idle") return;
        // @ts-expect-error - lib.dom typings
        this.analyser.getByteTimeDomainData(this.dataArray);
        let peak = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
          const v = Math.abs(this.dataArray[i] - 128) / 128;
          if (v > peak) peak = v;
        }
        this.emit("level", peak);
        this.rafHandle = requestAnimationFrame(loop);
      };
      this.rafHandle = requestAnimationFrame(loop);
    } catch {
      // No AudioContext support (e.g. JSDOM); skip level metering.
    }
  }

  private cleanup() {
    if (this.rafHandle) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    this.analyser = null;
    this.dataArray = null;
    this.mediaRecorder = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
