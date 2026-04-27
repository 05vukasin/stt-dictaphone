"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FiArrowLeft, FiMic, FiSearch } from "react-icons/fi";
import { useTranscripts } from "@/lib/storage/transcripts-store";
import { formatBytes, formatDuration, formatRelativeTime } from "@/lib/format";
import { IconButton } from "../ui/icon-button";

export function HistoryList() {
  const transcripts = useTranscripts();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return transcripts;
    return transcripts.filter((t) =>
      `${t.title} ${t.text} ${t.summary ?? ""}`.toLowerCase().includes(q),
    );
  }, [transcripts, query]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col px-4 pb-16 pt-5 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <Link href="/" className="contents">
          <IconButton label="Back" size="sm">
            <FiArrowLeft aria-hidden />
          </IconButton>
        </Link>
        <h1 className="text-sm font-semibold tracking-tight">History</h1>
        <span className="text-[11px] text-[var(--muted)] tabular">
          {transcripts.length} {transcripts.length === 1 ? "recording" : "recordings"}
        </span>
      </header>

      <div className="mt-5 flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 transition-colors focus-within:border-[var(--border-strong)]">
        <FiSearch aria-hidden className="size-4 text-[var(--muted)]" />
        <input
          type="search"
          placeholder="Search transcripts…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full appearance-none border-0 bg-transparent text-base outline-none ring-0 placeholder:text-[var(--muted)] sm:text-[13px]"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.currentTarget.blur();
              setQuery("");
            }
          }}
        />
      </div>

      <ul className="mt-5 flex flex-col gap-2">
        {filtered.length === 0 ? (
          <EmptyState hasAny={transcripts.length > 0} />
        ) : (
          filtered.map((t) => (
            <li key={t.id}>
              <Link
                href={`/recording/${t.id}`}
                className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:bg-[var(--surface-strong)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{t.title}</p>
                    <p className="mt-1 line-clamp-2 text-[12px] text-[var(--muted)]">
                      {t.status === "transcribing" || t.status === "queued"
                        ? "Transcribing…"
                        : t.status === "error"
                          ? `Error: ${t.errorMessage ?? "Unknown"}`
                          : t.text || "No transcript."}
                    </p>
                  </div>
                  {t.language ? (
                    <span className="rounded-md border border-[var(--border)] px-1.5 py-0.5 font-mono text-[10px] uppercase text-[var(--muted)]">
                      {t.language}
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-[var(--muted)] tabular">
                  <span>{formatDuration(t.durationMs)}</span>
                  <span>·</span>
                  <span>{formatBytes(t.sizeBytes)}</span>
                  <span>·</span>
                  <span>{formatRelativeTime(t.createdAt)}</span>
                </div>
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <li className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--border)] bg-transparent px-6 py-12 text-center">
      <FiMic className="size-6 text-[var(--muted)]" aria-hidden />
      <p className="text-[13px] font-medium">{hasAny ? "No matches" : "No recordings yet"}</p>
      {!hasAny ? (
        <Link
          href="/"
          className="mt-1 rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 py-1.5 text-[12px] font-medium transition-colors hover:bg-[var(--surface)]"
        >
          Make your first recording
        </Link>
      ) : null}
    </li>
  );
}
