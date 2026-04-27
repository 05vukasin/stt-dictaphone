"use client";

import { callSummarize, callTranscribe } from "./api-client";
import { putRecording } from "./storage/recordings-store";
import { getSettings } from "./storage/settings-store";
import { patchTranscript, upsertTranscript } from "./storage/transcripts-store";
import { newId } from "./id";
import { defaultRecordingTitle } from "./format";
import { toast } from "./use-toast";
import type { Transcript } from "@/types/recording";

interface SaveAndTranscribeOpts {
  blob: Blob;
  durationMs: number;
  mime: string;
}

export async function saveAndTranscribe({
  blob,
  durationMs,
  mime,
}: SaveAndTranscribeOpts): Promise<string> {
  const id = newId();
  const createdAt = Date.now();

  await putRecording({ id, blob, mime, createdAt });

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
  upsertTranscript(initial);

  // Fire transcription in background — don't block the UI.
  void runTranscription(id, blob);
  return id;
}

export async function runTranscription(id: string, blob?: Blob): Promise<void> {
  const settings = getSettings();
  const apiKey = settings.sttProvider === "openai" ? settings.openaiApiKey : settings.groqApiKey;
  if (!apiKey) {
    patchTranscript(id, {
      status: "error",
      errorMessage: `Add a ${settings.sttProvider} API key in Settings to transcribe.`,
    });
    toast.error("Missing API key", "Open Settings to enter your provider key.");
    return;
  }
  patchTranscript(id, { status: "transcribing", errorMessage: undefined });
  try {
    const audio = blob ?? (await loadBlob(id));
    if (!audio) throw new Error("Recording not found in storage.");
    const result = await callTranscribe({
      audio,
      provider: settings.sttProvider,
      apiKey,
      language: settings.language,
      prompt: settings.sttPrompt || undefined,
    });
    patchTranscript(id, {
      text: result.text,
      language: result.language,
      status: "done",
    });
    if (settings.autoSummarize && result.text.trim().length > 0) {
      void runSummary(id);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    patchTranscript(id, { status: "error", errorMessage: message });
    toast.error("Transcription failed", message);
  }
}

export async function runSummary(id: string): Promise<void> {
  const settings = getSettings();
  const apiKey =
    settings.summaryProvider === "openai"
      ? settings.openaiApiKey
      : settings.summaryProvider === "groq"
        ? settings.groqApiKey
        : settings.anthropicApiKey;
  if (!apiKey) {
    patchTranscript(id, {
      summaryStatus: "error",
      summaryError: `Add a ${settings.summaryProvider} API key in Settings to summarize.`,
    });
    toast.error("Missing API key", "Open Settings to enter your summary provider key.");
    return;
  }
  patchTranscript(id, { summaryStatus: "summarizing", summaryError: undefined });
  try {
    const transcript = await getTranscriptText(id);
    if (!transcript) throw new Error("Transcript text is empty.");
    const result = await callSummarize({
      text: transcript,
      provider: settings.summaryProvider,
      apiKey,
      prompt: settings.summaryPrompt,
    });
    patchTranscript(id, { summary: result.summary, summaryStatus: "done" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    patchTranscript(id, { summaryStatus: "error", summaryError: message });
    toast.error("Summary failed", message);
  }
}

async function loadBlob(id: string): Promise<Blob | undefined> {
  const { getRecording } = await import("./storage/recordings-store");
  const rec = await getRecording(id);
  return rec?.blob;
}

async function getTranscriptText(id: string): Promise<string> {
  const { getTranscript } = await import("./storage/transcripts-store");
  return getTranscript(id)?.text ?? "";
}
