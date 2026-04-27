"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiArrowLeft, FiCheck, FiEdit2, FiTrash2 } from "react-icons/fi";
import { useTranscript, deleteTranscript, patchTranscript } from "@/lib/storage/transcripts-store";
import { deleteRecording } from "@/lib/storage/recordings-store";
import { formatBytes, formatDuration, formatRelativeTime } from "@/lib/format";
import { AudioPlayer } from "./audio-player";
import { TranscriptView } from "./transcript-view";
import { SummaryView } from "./summary-view";
import { ExportMenu } from "./export-menu";
import { IconButton } from "../ui/icon-button";
import { toast } from "@/lib/use-toast";

export function RecordingDetail({ id }: { id: string }) {
  const router = useRouter();
  const transcript = useTranscript(id);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  if (!transcript) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 px-4 py-16 text-center">
        <p className="text-[13px] text-[var(--muted)]">Recording not found.</p>
        <Link href="/history" className="text-[12px] underline">
          Back to history
        </Link>
      </div>
    );
  }

  function startEdit() {
    setTitleDraft(transcript!.title);
    setEditingTitle(true);
  }

  function commitEdit() {
    const next = titleDraft.trim() || transcript!.title;
    patchTranscript(id, { title: next });
    setEditingTitle(false);
  }

  async function remove() {
    if (!confirm(`Delete "${transcript!.title}"? This cannot be undone.`)) return;
    deleteTranscript(id);
    await deleteRecording(id);
    toast.success("Recording deleted");
    router.push("/history");
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pb-16 pt-5 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <Link href="/history" className="contents">
          <IconButton label="Back" size="sm">
            <FiArrowLeft aria-hidden />
          </IconButton>
        </Link>
        <div className="flex items-center gap-1">
          <IconButton label="Rename" size="sm" onClick={startEdit}>
            <FiEdit2 aria-hidden />
          </IconButton>
          <IconButton label="Delete" size="sm" onClick={remove}>
            <FiTrash2 aria-hidden />
          </IconButton>
        </div>
      </header>

      <div>
        {editingTitle ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") setEditingTitle(false);
              }}
              className="flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--bg)] px-3 py-1.5 text-[15px] font-semibold outline-none"
            />
            <IconButton label="Save" size="sm" onClick={commitEdit} variant="solid">
              <FiCheck aria-hidden />
            </IconButton>
          </div>
        ) : (
          <h1 className="text-lg font-semibold tracking-tight">{transcript.title}</h1>
        )}
        <p className="mt-1 text-[11px] text-[var(--muted)] tabular">
          {formatDuration(transcript.durationMs)} · {formatBytes(transcript.sizeBytes)} ·{" "}
          {formatRelativeTime(transcript.createdAt)}
          {transcript.language ? ` · ${transcript.language}` : ""}
        </p>
      </div>

      <AudioPlayer id={id} mime={transcript.mime} />
      <TranscriptView transcript={transcript} />
      <SummaryView transcript={transcript} />
      <ExportMenu transcript={transcript} />
    </div>
  );
}
