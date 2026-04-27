"use client";

import type { SttProvider, SummaryProvider } from "@/types/settings";

export interface TranscribeOpts {
  audio: Blob;
  provider: SttProvider;
  apiKey: string;
  language?: string;
  prompt?: string;
}

export interface TranscribeResult {
  text: string;
  language?: string;
  durationSec?: number;
}

export async function callTranscribe(opts: TranscribeOpts): Promise<TranscribeResult> {
  const form = new FormData();
  form.append("audio", opts.audio, "recording.webm");
  if (opts.language) form.append("language", opts.language);
  if (opts.prompt) form.append("prompt", opts.prompt);
  const res = await fetch("/api/transcribe", {
    method: "POST",
    headers: {
      "x-stt-provider": opts.provider,
      "x-api-key": opts.apiKey,
    },
    body: form,
  });
  if (!res.ok) {
    const body = await safeText(res);
    throw new Error(extractError(body) || `Transcription failed (${res.status})`);
  }
  return (await res.json()) as TranscribeResult;
}

export interface SummarizeOpts {
  text: string;
  provider: SummaryProvider;
  apiKey: string;
  prompt: string;
  model?: string;
}

export interface SummarizeResult {
  summary: string;
  model: string;
}

export async function callSummarize(opts: SummarizeOpts): Promise<SummarizeResult> {
  const res = await fetch("/api/summarize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-summary-provider": opts.provider,
      "x-api-key": opts.apiKey,
    },
    body: JSON.stringify({ text: opts.text, prompt: opts.prompt, model: opts.model }),
  });
  if (!res.ok) {
    const body = await safeText(res);
    throw new Error(extractError(body) || `Summary failed (${res.status})`);
  }
  return (await res.json()) as SummarizeResult;
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function extractError(body: string): string | null {
  try {
    const parsed = JSON.parse(body);
    return typeof parsed.error === "string" ? parsed.error : null;
  } catch {
    return body || null;
  }
}
