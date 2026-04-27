"use client";

import { FiCopy, FiRefreshCcw, FiZap } from "react-icons/fi";
import type { Transcript } from "@/types/recording";
import { runSummary } from "@/lib/transcription-service";
import { toast } from "@/lib/use-toast";

interface SummaryViewProps {
  transcript: Transcript;
}

export function SummaryView({ transcript }: SummaryViewProps) {
  const isWorking =
    transcript.summaryStatus === "summarizing" || transcript.summaryStatus === "queued";
  const canSummarize = transcript.text.trim().length > 0;

  function copy() {
    if (!transcript.summary) return;
    navigator.clipboard
      .writeText(transcript.summary)
      .then(() => toast.success("Summary copied"))
      .catch(() => toast.error("Copy failed"));
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <header className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold">Summary</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={copy}
            disabled={!transcript.summary}
            className={btnCx + " disabled:opacity-40"}
          >
            <FiCopy aria-hidden />
            Copy
          </button>
          <button
            type="button"
            onClick={() => runSummary(transcript.id)}
            disabled={isWorking || !canSummarize}
            className={btnCx + " disabled:opacity-40"}
          >
            {transcript.summary ? (
              <FiRefreshCcw aria-hidden className={isWorking ? "animate-spin" : ""} />
            ) : (
              <FiZap aria-hidden />
            )}
            {isWorking ? "Summarizing…" : transcript.summary ? "Regenerate" : "Generate"}
          </button>
        </div>
      </header>

      {transcript.summaryStatus === "error" ? (
        <p className="text-[12px] text-[var(--record)]">{transcript.summaryError}</p>
      ) : transcript.summary ? (
        <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed text-[var(--fg)]">
          {transcript.summary}
        </pre>
      ) : isWorking ? (
        <p className="text-[12px] text-[var(--muted)]">Summarizing…</p>
      ) : (
        <p className="text-[12px] text-[var(--muted)]">
          {canSummarize
            ? "Click Generate to create a summary."
            : "Summary will be available once the transcript is ready."}
        </p>
      )}
    </section>
  );
}

const btnCx =
  "inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-[var(--surface)]";
