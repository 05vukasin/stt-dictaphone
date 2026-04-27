"use client";

import { FiDownload } from "react-icons/fi";
import type { Transcript } from "@/types/recording";
import { getRecording } from "@/lib/storage/recordings-store";
import { toast } from "@/lib/use-toast";

interface ExportMenuProps {
  transcript: Transcript;
}

export function ExportMenu({ transcript }: ExportMenuProps) {
  function exportTxt() {
    download(`${transcript.title}.txt`, transcript.text || "(empty)", "text/plain");
  }

  function exportMd() {
    const md = [
      `# ${transcript.title}`,
      "",
      `_Recorded ${new Date(transcript.createdAt).toLocaleString()}_`,
      "",
      transcript.summary ? `## Summary\n\n${transcript.summary}\n` : "",
      `## Transcript\n\n${transcript.text || "_(empty)_"}\n`,
    ].join("\n");
    download(`${transcript.title}.md`, md, "text/markdown");
  }

  function exportJson() {
    download(`${transcript.title}.json`, JSON.stringify(transcript, null, 2), "application/json");
  }

  async function exportAudio() {
    const rec = await getRecording(transcript.id);
    if (!rec) {
      toast.error("Audio not found");
      return;
    }
    const ext = rec.mime.includes("wav") ? "wav" : rec.mime.includes("mp4") ? "m4a" : "webm";
    download(`${transcript.title}.${ext}`, rec.blob, rec.mime);
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <ExportButton onClick={exportTxt} label=".txt" hint="plain text" />
      <ExportButton onClick={exportMd} label=".md" hint="markdown" />
      <ExportButton onClick={exportJson} label=".json" hint="all data" />
      <ExportButton onClick={exportAudio} label="audio" hint="original blob" />
    </div>
  );
}

function ExportButton({
  onClick,
  label,
  hint,
}: {
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex flex-col items-center justify-center gap-0.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-center transition-colors hover:bg-[var(--surface-strong)]"
    >
      <FiDownload aria-hidden className="size-3.5 text-[var(--muted)]" />
      <span className="text-[12px] font-medium">{label}</span>
      <span className="text-[10px] text-[var(--muted)]">{hint}</span>
    </button>
  );
}

function download(filename: string, content: string | Blob, mime: string) {
  const blob =
    content instanceof Blob ? content : new Blob([content], { type: mime || "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
