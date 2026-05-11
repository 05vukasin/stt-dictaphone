"use client";

import { callSummarize, callTranscribe } from "./api-client";
import { putRecording } from "./storage/recordings-store";
import { patchTranscript, upsertTranscript } from "./storage/transcripts-store";
import { newId } from "./id";
import { defaultRecordingTitle } from "./format";
import { toast } from "./use-toast";
import type { Transcript } from "@/types/recording";

// Provider, API key, language, and prompts are now resolved server-side from
// the user's effective settings — this module just orchestrates the storage
// + fetch calls. The browser only needs to know about saveAndTranscribe and
// when to fire the summary call.

interface SaveAndTranscribeOpts {
  blob: Blob;
  durationMs: number;
  mime: string;
  autoSummarize: boolean;
}

export async function saveAndTranscribe(
  userId: string,
  { blob, durationMs, mime, autoSummarize }: SaveAndTranscribeOpts,
): Promise<string> {
  const id = newId();
  const createdAt = Date.now();

  await putRecording(userId, { id, blob, mime, createdAt });

  const initial: Transcript = {
    id,
    title: defaultRecordingTitle(createdAt),
    text: "",
    durationMs,
    sizeBytes: blob.size,
    mime,
    createdAt,
    status: "queued",
    summaryStatus: "idle",
  };
  upsertTranscript(userId, initial);

  void runTranscription(userId, id, blob, { autoSummarize });
  return id;
}

export interface RunTranscriptionOpts {
  autoSummarize?: boolean;
}

export async function runTranscription(
  userId: string,
  id: string,
  blob?: Blob,
  opts: RunTranscriptionOpts = {},
): Promise<void> {
  patchTranscript(userId, id, { status: "transcribing", errorMessage: undefined });
  try {
    const audio = blob ?? (await loadBlob(userId, id));
    if (!audio) throw new Error("Recording not found in storage.");
    const result = await callTranscribe({ audio });
    patchTranscript(userId, id, {
      text: result.text,
      language: result.language,
      status: "done",
    });
    if (opts.autoSummarize && result.text.trim().length > 0) {
      void runSummary(userId, id);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    patchTranscript(userId, id, { status: "error", errorMessage: message });
    toast.error("Transcription failed", message);
  }
}

export async function runSummary(userId: string, id: string): Promise<void> {
  patchTranscript(userId, id, { summaryStatus: "summarizing", summaryError: undefined });
  try {
    const transcript = await getTranscriptText(userId, id);
    if (!transcript) throw new Error("Transcript text is empty.");
    const result = await callSummarize({ text: transcript });
    patchTranscript(userId, id, { summary: result.summary, summaryStatus: "done" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    patchTranscript(userId, id, { summaryStatus: "error", summaryError: message });
    toast.error("Summary failed", message);
  }
}

async function loadBlob(userId: string, id: string): Promise<Blob | undefined> {
  const { getRecording } = await import("./storage/recordings-store");
  const rec = await getRecording(userId, id);
  return rec?.blob;
}

async function getTranscriptText(userId: string, id: string): Promise<string> {
  const { getTranscript } = await import("./storage/transcripts-store");
  return getTranscript(userId, id)?.text ?? "";
}
