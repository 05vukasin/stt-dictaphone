"use client";

import { FiCopy, FiRefreshCcw } from "react-icons/fi";
import type { Transcript } from "@/types/recording";
import { runTranscription } from "@/lib/transcription-service";
import { toast } from "@/lib/use-toast";

interface TranscriptViewProps {
  transcript: Transcript;
}

export function TranscriptView({ transcript }: TranscriptViewProps) {
  const isWorking = transcript.status === "transcribing" || transcript.status === "queued";

  function copy() {
    navigator.clipboard
      .writeText(transcript.text)
      .then(() => toast.success("Transcript copied"))
      .catch(() => toast.error("Copy failed"));
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <header className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold">Transcript</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={copy}
            disabled={!transcript.text}
            className={btnCx + " disabled:opacity-40"}
          >
            <FiCopy aria-hidden />
            Copy
          </button>
          <button
            type="button"
            onClick={() => runTranscription(transcript.id)}
            disabled={isWorking}
            className={btnCx + " disabled:opacity-40"}
          >
            <FiRefreshCcw aria-hidden className={isWorking ? "animate-spin" : ""} />
            {isWorking ? "Transcribing…" : "Re-run"}
          </button>
        </div>
      </header>
      {transcript.status === "error" ? (
        <p className="text-[12px] text-[var(--record)]">{transcript.errorMessage}</p>
      ) : transcript.text ? (
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--fg)]">
          {transcript.text}
        </p>
      ) : isWorking ? (
        <p className="text-[12px] text-[var(--muted)]">Transcribing…</p>
      ) : (
        <p className="text-[12px] text-[var(--muted)]">No transcript yet.</p>
      )}
    </section>
  );
}

const btnCx =
  "inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-[var(--surface)]";
