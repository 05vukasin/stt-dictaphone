"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FiSettings, FiList } from "react-icons/fi";
import Link from "next/link";
import { WaveCanvas } from "./wave-canvas";
import { RecordButton } from "./record-button";
import { RecordingTimer } from "./recording-timer";
import { LevelMeter } from "./level-meter";
import { IconButton } from "../ui/icon-button";
import { SettingsOverlay } from "../settings/settings-overlay";
import { DictaphoneRecorder, type RecorderState } from "@/lib/recorder";
import { saveAndTranscribe } from "@/lib/transcription-service";
import { useSettings } from "@/lib/storage/settings-store";
import { toast } from "@/lib/use-toast";

export function RecorderShell() {
  const router = useRouter();
  const settings = useSettings();
  const [state, setState] = useState<RecorderState>("idle");
  const [durationMs, setDurationMs] = useState(0);
  const [peak, setPeak] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const recorderRef = useRef<DictaphoneRecorder | null>(null);

  // Tear down recorder on unmount
  useEffect(() => {
    return () => {
      recorderRef.current?.cancel();
    };
  }, []);

  // Keyboard shortcuts: Space toggles, S opens settings, H navigates to history
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (inEditable) return;
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        void toggle();
      } else if (e.key.toLowerCase() === "s" && !e.ctrlKey && !e.metaKey) {
        setSettingsOpen(true);
      } else if (e.key.toLowerCase() === "h" && !e.ctrlKey && !e.metaKey) {
        router.push("/history");
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  async function toggle() {
    const rec = recorderRef.current;
    if (rec && (state === "recording" || state === "paused")) {
      try {
        const blob = await rec.stop();
        recorderRef.current = null;
        setStream(null);
        if (blob.size > 0) {
          const id = await saveAndTranscribe({
            blob,
            durationMs,
            mime: rec.getMime() || "audio/webm",
          });
          toast.success("Recording saved", "Transcribing in the background.");
          router.push(`/recording/${id}`);
        }
        setDurationMs(0);
        setPeak(0);
      } catch (err) {
        toast.error("Recording error", err instanceof Error ? err.message : "Unknown");
      }
      return;
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Microphone unavailable", "Your browser does not support recording.");
      return;
    }

    const newRec = new DictaphoneRecorder(settings.audioFormat, settings.micDeviceId);
    newRec.on("state", setState);
    newRec.on("durationMs", setDurationMs);
    newRec.on("level", setPeak);
    newRec.on("error", (err) => {
      toast.error("Recorder error", err.message);
    });
    try {
      await newRec.start();
      recorderRef.current = newRec;
      setStream(newRec.getStream());
    } catch (err) {
      toast.error("Microphone blocked", err instanceof Error ? err.message : "Permission denied");
      setState("idle");
    }
  }

  const isActive = state === "recording" || state === "paused";

  return (
    <div className="relative flex min-h-[100dvh] flex-col">
      <header className="flex items-center justify-between px-5 pt-5 sm:px-8 sm:pt-6">
        <div className="flex items-center gap-2 text-[12px] font-medium tracking-tight text-[var(--muted)]">
          <span className="size-2 rounded-full bg-[var(--fg)]" aria-hidden />
          Dictaphone
        </div>
        <div className="flex items-center gap-1">
          <Link href="/history" className="contents">
            <IconButton label="History" size="sm">
              <FiList aria-hidden />
            </IconButton>
          </Link>
          <IconButton label="Settings" size="sm" onClick={() => setSettingsOpen(true)}>
            <FiSettings aria-hidden />
          </IconButton>
        </div>
      </header>

      <main className="relative flex flex-1 flex-col items-center justify-end px-5 pb-16 pt-6 sm:px-8 sm:pb-24">
        <div className="pointer-events-none absolute inset-x-0 top-[18%] h-44 sm:top-[20%] sm:h-56">
          <WaveCanvas stream={stream} isActive={isActive} />
        </div>

        <div className="z-10 flex flex-col items-center gap-6 pb-2 sm:pb-6">
          <div className="flex items-center gap-3">
            <RecordingTimer ms={durationMs} active={isActive} />
            <LevelMeter peak={peak} active={isActive} />
          </div>
          <RecordButton state={state} onToggle={toggle} />
          <p className="max-w-xs text-center text-[12px] text-[var(--muted)]">
            {state === "idle"
              ? "Press the button or hit Space to start recording."
              : state === "recording"
                ? "Listening… speak naturally. Press Space to stop."
                : state === "paused"
                  ? "Paused."
                  : "Saving…"}
          </p>
        </div>
      </main>

      <SettingsOverlay open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
