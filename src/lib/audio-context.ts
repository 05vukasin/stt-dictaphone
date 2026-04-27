"use client";

let ctx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (typeof window === "undefined") {
    throw new Error("AudioContext is only available in the browser");
  }
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((window as any).webkitAudioContext as typeof AudioContext);
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") {
    void ctx.resume();
  }
  return ctx;
}

export interface AnalyserSetup {
  analyser: AnalyserNode;
  source: MediaStreamAudioSourceNode;
  disconnect(): void;
}

export function attachAnalyser(
  stream: MediaStream,
  fftSize = 512,
  smoothingTimeConstant = 0.55,
): AnalyserSetup {
  const audio = getAudioContext();
  const source = audio.createMediaStreamSource(stream);
  const analyser = audio.createAnalyser();
  analyser.fftSize = fftSize;
  analyser.smoothingTimeConstant = smoothingTimeConstant;
  source.connect(analyser);
  return {
    analyser,
    source,
    disconnect() {
      try {
        source.disconnect();
        analyser.disconnect();
      } catch {
        // already disconnected
      }
    },
  };
}
